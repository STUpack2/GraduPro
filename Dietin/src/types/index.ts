export interface CalorieEntry {
  id: string;
  foodName: string;
  description: string;
  mealTag: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timestamp: string;
  healthScore: number;
  isUSDA?: boolean;
  usdaId?: string;
  portionSize?: number;
  portionUnit?: string;
  // Additional macro nutrients
  cholesterol?: number;
  magnesium?: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  calcium?: number;
  iron?: number;
  ingredients?: string[];
}
