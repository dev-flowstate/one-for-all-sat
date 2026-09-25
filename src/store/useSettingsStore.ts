import { create } from 'zustand';
import { DEFAULT_AVATARS, type LocalProfile } from '../types/settings';
import { getProfile, setProfile as persistProfile } from '../lib/storage/localStorage';

interface SettingsStore {
  profile: LocalProfile | null;
  loadProfile: () => void;
  saveProfile: (nickname: string, avatar: string) => void;
  setHideFromLeaderboard: (hidden: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  profile: null,
  loadProfile: () => set({ profile: getProfile() }),
  saveProfile: (nickname, avatar) => {
    // Spread first, so settings kept on the profile (like leaderboard visibility) survive.
    const profile: LocalProfile = { ...get().profile, nickname, avatar, createdAt: new Date().toISOString() };
    persistProfile(profile);
    set({ profile });
  },
  setHideFromLeaderboard: (hidden) => {
    const current = get().profile ?? { nickname: 'Student', avatar: DEFAULT_AVATARS[0], createdAt: new Date().toISOString() };
    const profile: LocalProfile = { ...current, hideFromLeaderboard: hidden };
    persistProfile(profile);
    set({ profile });
  },
}));
