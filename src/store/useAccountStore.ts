import { create } from 'zustand';
import type { CompletedTest } from '../types/practiceTest';
import type { AccountUser } from '../lib/cloud/firebaseClient';
import { cloudConfigured } from '../lib/cloud/config';
import { mergeAccountData, type AccountData } from '../lib/cloud/merge';
import {
  DEFAULT_STATS,
  getAccountOwner,
  getActiveTest,
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
import { usePracticeTestStore } from './usePracticeTestStore';

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
  init: () => void;
  /** Starts downloading Firebase, so a later tap on "Sign in" doesn't have to wait for it. */
  prepare: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** After an error: connects again, or saves again if already connected. */
  retry: () => void;
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
  usePracticeTestStore.setState({ active: data.activeTest, history: data.history });
}

const EMPTY: AccountData = {
  email: null,
  progress: {},
  stats: DEFAULT_STATS,
  vocabProgress: {},
  profile: null,
  activeTest: null,
  history: [],
};

function testsToSave(history: CompletedTest[]): CompletedTest[] {
  return history.filter((t) => savedTests.get(t.completedAt) !== t.number);
}

export const useAccountStore = create<AccountState>((set, get) => {
  function loadClient(): Promise<Client> {
    clientPromise ??= import('../lib/cloud/firebaseClient').then((client) => {
      client.watchUser((user) => {
        if (user) void connect(user);
        else if (get().status === 'checking') set({ status: 'signed-out' });
      });
      loadedClient = client;
      return client;
    });
    return clientPromise;
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
      usePracticeTestStore.subscribe((s, p) => (s.active !== p.active || s.history !== p.history) && scheduleSave()),
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
      savedTests = new Map();
      // The progress is safe in the account. Leaving it here would hand it to whoever signs in
      // on this browser next.
      writeLocal({ ...EMPTY });
      setAccountOwner(null);
      set({ user: null, status: 'signed-out', error: null });
    },

    retry: () => {
      const { user } = get();
      if (!user) return;
      if (connectedUid === user.uid) void save();
      else void connect(user);
    },
  };
});
