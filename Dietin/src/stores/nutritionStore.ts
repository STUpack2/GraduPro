import { create } from 'zustand';

interface NutritionState {
  exceededNutrient: {
    type: string;
    amount: number;
    goal: number;
  } | null;
  burnedCalories: number;
  setExceededNutrient: (nutrient: { type: string; amount: number; goal: number } | null) => void;
  addBurnedCalories: (calories: number) => void;
  resetBurnedCalories: () => void;
}

export const useNutritionStore = create<NutritionState>((set) => ({
  exceededNutrient: null,
  burnedCalories: 0,
  setExceededNutrient: (nutrient) => set({ exceededNutrient: nutrient }),
  addBurnedCalories: (calories) => set((state) => ({ 
    burnedCalories: state.burnedCalories + calories 
  })),
  resetBurnedCalories: () => set({ burnedCalories: 0 }),
})); 