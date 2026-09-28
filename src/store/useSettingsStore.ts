import { create } from 'zustand';
import { DEFAULT_AVATARS, type LocalProfile } from '../types/settings';
import { getProfile, setProfile as persistProfile } from '../lib/storage/localStorage';

interface SettingsStore {
  profile: LocalProfile | null;
  loadProfile: () => void;
  saveProfile: (nickname: string, avatar: string) => void;
  setHideFromLeaderboard: (hidden: boolean) => void;
  setSatDate: (date: string | undefined) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => {
  function update(change: Partial<LocalProfile>) {
    const current = get().profile ?? { nickname: 'Student', avatar: DEFAULT_AVATARS[0], createdAt: new Date().toISOString() };
    const profile: LocalProfile = { ...current, ...change };
    persistProfile(profile);
    set({ profile });
  }

  return {
    // Read straight away, so what the home screen shows from it (the SAT countdown) is there on
    // the first paint rather than appearing a moment later.
    profile: getProfile(),
    loadProfile: () => set({ profile: getProfile() }),
    saveProfile: (nickname, avatar) => {
      // Spread first, so settings kept on the profile (like leaderboard visibility) survive.
      const profile: LocalProfile = { ...get().profile, nickname, avatar, createdAt: new Date().toISOString() };
      persistProfile(profile);
      set({ profile });
    },
    setHideFromLeaderboard: (hidden) => update({ hideFromLeaderboard: hidden }),
    setSatDate: (date) => update({ satDate: date }),
  };
});
