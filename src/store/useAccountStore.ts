import { create } from 'zustand';
import type { ActiveTest, CompletedTest } from '../types/practiceTest';
import type { AccountUser, LeaderboardEntry } from '../lib/cloud/firebaseClient';
import { cloudConfigured } from '../lib/cloud/config';
import { mergeAccountData, type AccountData } from '../lib/cloud/merge';
import {
  DEFAULT_STATS,
  getAccountOwner,
  getActiveTest,
  getPausedTests,
  getProfile,
  getProgress,
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
import { useProgressStore } from './useProgressStore';
import { useVocabStore } from './useVocabStore';
import { useSettingsStore } from './useSettingsStore';
import { upgradeSavedHistory, upgradeSavedTest, usePracticeTestStore } from './usePracticeTestStore';

export type AccountStatus =
  /** No Firebase project configured: accounts don't exist on this build. */
  | 'off'
  | 'signed-out'
  /** Waiting to hear from Firebase whether a saved sign-in is still good. */
  | 'checking'
  | 'syncing'
  | 'synced'
  | 'error';

interface AccountState {
  status: AccountStatus;
  user: AccountUser | null;
  error: string | null;
  /** Firebase has finished starting up, so a tap on "Sign in" can open the window at once. */
  ready: boolean;
  init: () => void;
  /** Starts downloading Firebase, so a later tap on "Sign in" doesn't have to wait for it. */
  prepare: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** After an error: connects again, or saves again if already connected. */
  retry: () => void;
  /** The top of the leaderboard. Anyone can read it, signed in or not. */
  fetchLeaderboard: (count: number) => Promise<(LeaderboardEntry & { uid: string })[]>;
}

type Client = typeof import('../lib/cloud/firebaseClient');

/** Changes are saved at most this often, since a practice test changes something every second. */
const SAVE_INTERVAL_MS = 10_000;

let clientPromise: Promise<Client> | null = null;
let loadedClient: Client | null = null;
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
};

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

export const useAccountStore = create<AccountState>((set, get) => {
  function loadClient(): Promise<Client> {
    clientPromise ??= import('../lib/cloud/firebaseClient').then((client) => {
      client.watchUser((user) => {
        // The first call comes once Firebase has finished starting up. On phones and in Safari
        // that includes loading the helper page the sign-in window needs; until it's loaded, a
        // tap reaches the window too late and the browser blocks it as a pop-up.
        if (!get().ready) set({ ready: true });
        if (user) void connect(user);
        else if (get().status === 'checking') set({ status: 'signed-out' });
      });
      loadedClient = client;
      return client;
    });
    return clientPromise;
  }

  /** Kept apart from the account save: a refused leaderboard write (rules not yet published,
   *  say) must never stop someone's progress from being saved. It's retried on the next save. */
  async function syncLeaderboard(client: Client, user: AccountUser, data: AccountData) {
    const entry = leaderboardEntry(data, user);
    const key = entry ? JSON.stringify({ ...entry, updatedAt: '' }) : 'hidden';
    if (key === sentLeaderboard) return;
    try {
      await client.writeLeaderboardEntry(user.uid, entry);
      sentLeaderboard = key;
    } catch {
      // Left for the next save.
    }
  }

  async function save() {
    saveTimer = null;
    const { user } = get();
    if (!user) return;
    const client = await loadClient();
    const data = readLocal(user.email);
    const tests = testsToSave(data.history);
    set({ status: 'syncing' });
    try {
      await client.writeAccount(user.uid, data, tests);
      for (const t of tests) savedTests.set(t.completedAt, t.number);
      set({ status: 'synced', error: null });
      void syncLeaderboard(client, user, data);
    } catch {
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
    void save();
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
      const client = await loadClient();
      const cloud = await client.readAccount(user.uid);
      const owner = getAccountOwner();
      // What's in this browser belongs to someone else when another account signed in here
      // before, so it's left out. Otherwise it's this person's, and joins their account.
      const local = owner && owner !== user.uid ? { ...EMPTY } : readLocal(user.email);
      const merged = cloud ? mergeAccountData(local, cloud) : local;
      merged.email = user.email;
      if (!merged.profile && user.name) {
        merged.profile = { nickname: user.name.split(' ')[0], avatar: DEFAULT_AVATARS[0], createdAt: new Date().toISOString() };
      }

      writeLocal(merged);
      setAccountOwner(user.uid);
      savedTests = new Map((cloud?.history ?? []).map((t) => [t.completedAt, t.number]));
      await client.writeAccount(user.uid, merged, testsToSave(merged.history));
      for (const t of merged.history) savedTests.set(t.completedAt, t.number);
      watchStores();
      connectedUid = user.uid;
      set({ status: 'synced' });
      void syncLeaderboard(client, user, merged);
    } catch {
      set({ status: 'error', error: "Couldn't reach your account. Your progress is still saved in this browser." });
    } finally {
      connectingUid = null;
    }
  }

  return {
    status: cloudConfigured ? 'signed-out' : 'off',
    user: null,
    error: null,
    ready: false,

    init: () => {
      // Firebase only loads for someone who signed in on this browser before.
      if (!cloudConfigured || !getAccountOwner()) return;
      set({ status: 'checking' });
      void loadClient();
    },

    prepare: () => {
      if (cloudConfigured) void loadClient();
    },

    signIn: async () => {
      set({ error: null });
      try {
        // Phone browsers, Safari above all, only let a page open a window while the tap that
        // asked for it is still being handled. Waiting on a download first uses that up and
        // the sign-in window is blocked, so the window opens straight away whenever Firebase
        // is already here, which prepare() sees to.
        const client = loadedClient ?? (await loadClient());
        await client.signInWithGoogle();
        // The watcher picks the new user up and connects.
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        set({
          error:
            code === 'auth/popup-blocked'
              ? 'Your browser blocked the sign-in window. Tap Sign in with Google again. If it is blocked a second time, allow pop-ups for this site.'
              : "Couldn't sign in. Check your connection and try again.",
        });
      }
    },

    signOut: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        await save();
      }
      const client = await loadClient();
      await client.signOut();
      stopWatchingStores?.();
      stopWatchingStores = null;
      connectedUid = null;
      sentLeaderboard = null;
      savedTests = new Map();
      // The progress is safe in the account. Leaving it here would hand it to whoever signs in
      // on this browser next.
      writeLocal({ ...EMPTY });
      setAccountOwner(null);
      set({ user: null, status: 'signed-out', error: null });
    },

    fetchLeaderboard: async (count) => {
      if (!cloudConfigured) return [];
      const client = await loadClient();
      return client.readLeaderboard(count);
    },

    retry: () => {
      const { user } = get();
      if (!user) return;
      if (connectedUid === user.uid) void save();
      else void connect(user);
    },
  };
});
