declare module 'fitness-calculator' {
  export function BMR(
    gender: 'male' | 'female',
    age: number,
    heightCm: number,
    weightKg: number
  ): number;

  export function TDEE(
    gender: 'male' | 'female',
    age: number,
    heightCm: number,
    weightKg: number,
    activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'extreme'
  ): number;

  export function calorieNeeds(
    gender: 'male' | 'female',
    age: number,
    heightCm: number,
    weightKg: number,
    activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'extreme'
  ): {
    balance: number;
    mildWeightLoss: number;
    mildWeightGain: number;
    heavyWeightLoss: number;
    heavyWeightGain: number;
  };
}
