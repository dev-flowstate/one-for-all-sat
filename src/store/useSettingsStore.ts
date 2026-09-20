import { create } from 'zustand';
import type { LocalProfile } from '../types/settings';
import { getProfile, setProfile as persistProfile } from '../lib/storage/localStorage';

interface SettingsStore {
  profile: LocalProfile | null;
  loadProfile: () => void;
  saveProfile: (nickname: string, avatar: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  profile: null,
  loadProfile: () => set({ profile: getProfile() }),
  saveProfile: (nickname, avatar) => {
    const profile: LocalProfile = { nickname, avatar, createdAt: new Date().toISOString() };
    persistProfile(profile);
    set({ profile });
  },
}));
