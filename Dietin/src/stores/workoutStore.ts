import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Exercise {
  id: string;
  name: string;
  force?: string;
  level: string;
  mechanic?: string;
  equipment?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

interface WorkoutState {
  favorites: Exercise[];
  addFavorite: (exercise: Exercise) => void;
  removeFavorite: (exerciseId: string) => void;
  getFavorites: () => Exercise[];
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (exercise) => {
        set((state) => {
          // Check if already in favorites
          if (state.favorites.some(fav => fav.id === exercise.id)) {
            return state;
          }

          const newFavorites = [...state.favorites, exercise];

          return { favorites: newFavorites };
        });
      },

      removeFavorite: (exerciseId) => {
        set((state) => {
          const newFavorites = state.favorites.filter(
            (exercise) => exercise.id !== exerciseId
          );

          return { favorites: newFavorites };
        });
      },

      getFavorites: () => {
        return get().favorites;
      },
    }),
    {
      name: 'workout-storage',
      partialize: (state) => ({
        favorites: state.favorites,
      }),
    }
  )
); 