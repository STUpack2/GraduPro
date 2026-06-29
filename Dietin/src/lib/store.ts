import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from './types';

interface UserState {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        }));
      },
      logout: () => {
        set({ user: null });
      }
    }),
    {
      name: 'user-storage'
    }
  )
);
