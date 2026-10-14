import { create } from 'zustand';
import type { ActiveTest, CompletedTest } from '../types/practiceTest';
import * as cloud from '../lib/cloud/cloudClient';
import type { AccountUser, LeaderboardEntry } from '../lib/cloud/cloudClient';
import { cloudConfigured } from '../lib/cloud/config';
import { mergeAccountData, type AccountData } from '../lib/cloud/merge';
import {
  DEFAULT_STATS,
  getAccountOwner,
  getActiveTest,
  getPausedTests,
  getProfile,
  getProgress,
  getSession,
  getStats,
  getTestHistory,
  getVocabProgress,
  setAccountOwner,
  setProfile,
  setProgress,
  setStats,
  setVocabProgress,
} from '../lib/storage/localStorage';
import { DEFAULT_AVATARS } from '../types/settings';
import { clearActivity, ownActivity, setAccountActivity } from '../lib/activity';
import { clearDoodles, markDoodlesSent, mergeDoodles, onDoodleChange, pendingDoodleRecords } from '../lib/doodles';
import { useProgressStore } from './useProgressStore';
import { useVocabStore } from './useVocabStore';
import { useSettingsStore } from './useSettingsStore';
import { upgradeSavedHistory, upgradeSavedTest, usePracticeTestStore } from './usePracticeTestStore';

export type AccountStatus =
  /** No account Worker configured: accounts don't exist on this build. */
  | 'off'
  | 'signed-out'
  /** Waiting to hear from the Worker whether a saved sign-in is still good. */
  | 'checking'
  | 'syncing'
  | 'synced'
  | 'error';

interface AccountState {
  status: AccountStatus;
  user: AccountUser | null;
  error: string | null;
  init: () => void;
  /** Sends this tab to Google's sign-in page; init() finishes signing in when it comes back. */
  signIn: () => void;
  signOut: () => Promise<void>;
  /** After an error: connects again, or saves again if already connected. */
  retry: () => void;
  /** The top of the leaderboard. Anyone can read it, signed in or not. */
  fetchLeaderboard: (count: number) => Promise<(LeaderboardEntry & { uid: string })[]>;
}

/** Changes are saved at most this often, since a practice test changes something every second.
 *  Each save is a request to the Worker, so this is what most decides how many people it can
 *  serve; anything newer is saved when the page is left, and is in the browser meanwhile. */
const SAVE_INTERVAL_MS = 60_000;

/** Finished tests already in the account, by when they finished, with the number they have there. */
let savedTests = new Map<string, number>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let stopWatchingStores: (() => void) | null = null;
/** The account this session has merged with and is saving to. */
let connectedUid: string | null = null;
let connectingUid: string | null = null;
/** The leaderboard entry last sent, so an unchanged one isn't written again. */
let sentLeaderboard: string | null = null;

/** Everything this browser holds, read from storage rather than the stores, which may not have
 *  loaded yet when a saved sign-in is restored. */
function readLocal(email: string | null): AccountData {
  return {
    email,
    progress: getProgress(),
    stats: getStats(),
    vocabProgress: getVocabProgress(),
    profile: getProfile(),
    activeTest: getActiveTest(),
    pausedTests: getPausedTests(),
    history: getTestHistory(),
    activity: ownActivity(),
  };
}

function writeLocal(data: AccountData) {
  setProgress(data.progress);
  setStats(data.stats);
  setVocabProgress(data.vocabProgress);
  setProfile(data.profile);
  useProgressStore.setState({ progress: data.progress, stats: data.stats });
  useVocabStore.setState({ progress: data.vocabProgress });
  useSettingsStore.setState({ profile: data.profile });
  // This store saves itself whenever it changes.
  usePracticeTestStore.setState({
    active: upgradeSavedTest(data.activeTest),
    paused: (data.pausedTests ?? []).map((t) => upgradeSavedTest(t) as ActiveTest),
    history: upgradeSavedHistory(data.history),
  });
  setAccountActivity(data.activity ?? {});
}

const EMPTY: AccountData = {
  email: null,
  progress: {},
  stats: DEFAULT_STATS,
  vocabProgress: {},
  profile: null,
  activeTest: null,
  pausedTests: [],
  history: [],
  activity: {},
};

/** Sends the doodles waiting to go, after the account itself. */
async function sendPendingDoodles() {
  const pending = pendingDoodleRecords();
  if (pending.length === 0) return;
  await cloud.writeDoodles(pending);
  markDoodlesSent(pending);
}

/** What the leaderboard shows of someone: their nickname and avatar, and how many questions
 *  they've answered. Null when they've chosen to stay off it. */
function leaderboardEntry(data: AccountData, user: AccountUser): LeaderboardEntry | null {
  if (data.profile?.hideFromLeaderboard) return null;
  const statuses = Object.values(data.progress);
  const name = (data.profile?.nickname || user.name?.split(' ')[0] || '').trim().slice(0, 40) || 'Student';
  return {
    name,
    avatar: (data.profile?.avatar || DEFAULT_AVATARS[0]).slice(0, 16),
    answered: statuses.filter((s) => s.status !== 'unattempted').length,
    correct: statuses.filter((s) => s.status === 'correct').length,
    updatedAt: new Date().toISOString(),
  };
}

function testsToSave(history: CompletedTest[]): CompletedTest[] {
  return history.filter((t) => savedTests.get(t.completedAt) !== t.number);
}

/** The leaderboard entry to send with a save, undefined when it's the same as last sent. */
function leaderboardChange(data: AccountData, user: AccountUser) {
  const entry = leaderboardEntry(data, user);
  const key = entry ? JSON.stringify({ ...entry, updatedAt: '' }) : 'hidden';
  return { entry: key === sentLeaderboard ? undefined : entry, key };
}

const SIGNED_OUT_MESSAGE = 'You were signed out. Sign in again to keep saving to your account.';
const SIGN_IN_FAILED_MESSAGE = "Couldn't sign in. Check your connection and try again.";

export const useAccountStore = create<AccountState>((set, get) => {
  /** A session that has run out: saving stops, and what's in this browser stays as it is. */
  function endSession() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    stopWatchingStores?.();
    stopWatchingStores = null;
    connectedUid = null;
    sentLeaderboard = null;
    cloud.signOut();
    set({ user: null, status: 'signed-out', error: SIGNED_OUT_MESSAGE });
  }

  async function save(closing = false) {
    saveTimer = null;
    const { user } = get();
    if (!user) return;
    const data = readLocal(user.email);
    const tests = testsToSave(data.history);
    const leaderboard = leaderboardChange(data, user);
    set({ status: 'syncing' });
    try {
      await cloud.writeAccount(data, tests, leaderboard.entry, closing);
      await sendPendingDoodles();
      for (const t of tests) savedTests.set(t.completedAt, t.number);
      if (leaderboard.entry !== undefined) sentLeaderboard = leaderboard.key;
      set({ status: 'synced', error: null });
    } catch (err) {
      if (err instanceof cloud.CloudError && err.code === 'signed-out') return endSession();
      // Tried again with the next change.
      set({ status: 'error', error: "Couldn't save to your account. It will try again with your next answer." });
    }
  }

  function scheduleSave() {
    saveTimer ??= setTimeout(() => void save(), SAVE_INTERVAL_MS);
  }

  function flush() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    void save(true);
  }

  function watchStores() {
    stopWatchingStores?.();
    const stops = [
      useProgressStore.subscribe((s, p) => (s.progress !== p.progress || s.stats !== p.stats) && scheduleSave()),
      useVocabStore.subscribe((s, p) => s.progress !== p.progress && scheduleSave()),
      useSettingsStore.subscribe((s, p) => s.profile !== p.profile && scheduleSave()),
      usePracticeTestStore.subscribe(
        (s, p) => (s.active !== p.active || s.paused !== p.paused || s.history !== p.history) && scheduleSave(),
      ),
      onDoodleChange(scheduleSave),
    ];
    // Leaving the page is the last chance to save what's waiting on the timer.
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    stopWatchingStores = () => {
      stops.forEach((stop) => stop());
      document.removeEventListener('visibilitychange', onHide);
    };
  }

  async function connect(user: AccountUser) {
    if (connectedUid === user.uid || connectingUid === user.uid) return;
    connectingUid = user.uid;
    set({ user, status: 'syncing', error: null });
    try {
      const saved = await cloud.readAccount();
      const owner = getAccountOwner();
      // What's in this browser belongs to someone else when another account signed in here
      // before, so it's left out. Otherwise it's this person's, and joins their account.
      const someoneElses = !!owner && owner !== user.uid;
      if (someoneElses) {
        clearActivity();
        clearDoodles();
      }
      const local = someoneElses ? { ...EMPTY } : readLocal(user.email);
      const merged = saved ? mergeAccountData(local, saved) : local;
      merged.email = user.email;
      if (!merged.profile && user.name) {
        merged.profile = { nickname: user.name.split(' ')[0], avatar: DEFAULT_AVATARS[0], createdAt: new Date().toISOString() };
      }

      writeLocal(merged);
      setAccountOwner(user.uid);
      savedTests = new Map((saved?.history ?? []).map((t) => [t.completedAt, t.number]));
      const leaderboard = leaderboardChange(merged, user);
      await cloud.writeAccount(merged, testsToSave(merged.history), leaderboard.entry);
      for (const t of merged.history) savedTests.set(t.completedAt, t.number);
      sentLeaderboard = leaderboard.key;
      // Doodles: the account's newer ones come here, and this browser's newer ones go there.
      const toSend = mergeDoodles(await cloud.readDoodles());
      await cloud.writeDoodles(toSend);
      markDoodlesSent(toSend);
      watchStores();
      connectedUid = user.uid;
      set({ status: 'synced' });
    } catch (err) {
      if (err instanceof cloud.CloudError && err.code === 'signed-out') return endSession();
      set({ status: 'error', error: "Couldn't reach your account. Your progress is still saved in this browser." });
    } finally {
      connectingUid = null;
    }
  }

  return {
    // Someone signed in on this browser starts as "checking", not "signed out": the latter
    // showed the home screen's sign-in banner for a frame before hiding it again, and the jump
    // it gave everything below was the page's layout shift.
    status: !cloudConfigured ? 'off' : getSession() || cloud.backFromGoogle() ? 'checking' : 'signed-out',
    user: null,
    error: null,

    init: () => {
      if (!cloudConfigured) return;
      if (cloud.backFromGoogle()) {
        set({ status: 'checking' });
        cloud.finishGoogleSignIn().then(connect, (err) => {
          const cancelled = err instanceof cloud.CloudError && err.code === 'cancelled';
          set({ status: 'signed-out', error: cancelled ? null : SIGN_IN_FAILED_MESSAGE });
        });
        return;
      }
      const user = cloud.sessionUser();
      if (!user) return;
      set({ status: 'checking' });
      void connect(user);
    },

    signIn: () => {
      set({ error: null });
      cloud.startGoogleSignIn();
    },

    signOut: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        await save();
      }
      cloud.signOut();
      stopWatchingStores?.();
      stopWatchingStores = null;
      connectedUid = null;
      sentLeaderboard = null;
      savedTests = new Map();
      // The progress is safe in the account. Leaving it here would hand it to whoever signs in
      // on this browser next.
      writeLocal({ ...EMPTY });
      clearActivity();
      clearDoodles();
      setAccountOwner(null);
      set({ user: null, status: 'signed-out', error: null });
    },

    fetchLeaderboard: async (count) => {
      if (!cloudConfigured) return [];
      return cloud.readLeaderboard(count);
    },

    retry: () => {
      const { user } = get();
      if (!user) return;
      if (connectedUid === user.uid) void save();
      else void connect(user);
    },
  };
});
