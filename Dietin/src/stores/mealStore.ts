import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MealSuggestion {
  name: string;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeToMake: string;
  budget: '€' | '€€' | '€€€';
  quickRecipe: string;
  cuisine: string;
}

interface MealStore {
  suggestions: MealSuggestion[];
  setSuggestions: (suggestions: MealSuggestion[]) => void;
  clearSuggestions: () => void;
  lastUpdated: string | null;
  lastMealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | null;
  setLastMealType: (type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack') => void;
}

export const useMealStore = create<MealStore>()(
  persist(
    (set) => ({
      suggestions: [],
      lastUpdated: null,
      lastMealType: null,
      setSuggestions: (suggestions) => 
        set({ 
          suggestions,
          lastUpdated: new Date().toISOString()
        }),
      clearSuggestions: () => 
        set({ 
          suggestions: [],
          lastUpdated: null,
          lastMealType: null
        }),
      setLastMealType: (type) =>
        set({
          lastMealType: type
        })
    }),
    {
      name: 'meal-suggestions',
      partialize: (state) => ({ 
        suggestions: state.suggestions,
        lastUpdated: state.lastUpdated,
        lastMealType: state.lastMealType
      }),
    }
  )
);
