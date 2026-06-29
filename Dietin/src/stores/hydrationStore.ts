import { create } from 'zustand';

export interface DrinkSuggestion {
  name: string;
  type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  difficulty: "Easy" | "Medium" | "Hard";
  timeToMake: string;
  budget: "€" | "€€" | "€€€";
  quickRecipe: string;
}

interface HydrationStore {
  suggestions: DrinkSuggestion[];
  setSuggestions: (suggestions: DrinkSuggestion[]) => void;
  lastUpdated: string | null;
  lastDrinkType: string | null;
  setLastDrinkType: (type: string) => void;
}

export const useHydrationStore = create<HydrationStore>((set) => ({
  suggestions: [],
  setSuggestions: (suggestions) => set({ suggestions, lastUpdated: new Date().toISOString() }),
  lastUpdated: null,
  lastDrinkType: null,
  setLastDrinkType: (type) => set({ lastDrinkType: type })
})); 