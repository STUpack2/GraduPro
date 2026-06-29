import { UserProfile, Goal, ActivityLevel, Gender } from './types';

export interface AnalysisResult {
  goal: string;
  calories: number;        // Recommended daily calories based on goal
  metabolism: number;      // TDEE (maintenance)
  protein: number;         // grams
  carbs: number;           // grams
  fat: number;             // grams
  estimatedWeeks: number;  // ETA to reach target
}

// Standard activity multipliers sourced from widely accepted guidelines
// Sedentary 1.2; Lightly Active 1.375; Moderately Active 1.55; Very Active 1.725; Extra Active 1.9
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTRA_ACTIVE: 1.9,
};

function getActivityMultiplier(level?: ActivityLevel): number {
  if (!level) return 1.2; // sedentary default when user hasn't set activity
  return ACTIVITY_MULTIPLIER[level] ?? 1.55;
}

function deriveAge(profile: Partial<UserProfile>): number | undefined {
  if (typeof profile.age === 'number') return profile.age;
  const { birthYear, birthMonth, birthDay } = profile;
  if (!birthYear || !birthMonth || !birthDay) return undefined;
  const y = Number(birthYear);
  const m = Number(birthMonth) - 1;
  const d = Number(birthDay);
  const dob = new Date(y, m, d);
  if (isNaN(dob.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const mdiff = today.getMonth() - dob.getMonth();
  if (mdiff < 0 || (mdiff === 0 && today.getDate() < dob.getDate())) age--;
  return Math.max(12, Math.min(100, age));
}

// Mifflin-St Jeor BMR (kg, cm, years)
function mifflinStJeorBMR({ gender, weight, height, age }: { gender: Gender | undefined; weight: number; height: number; age: number; }): number {
  const sexConst = gender === 'FEMALE' ? -161 : 5; // default to male if missing
  return 10 * weight + 6.25 * height - 5 * age + sexConst;
}

function goalToLabel(goal?: Goal): string {
  switch (goal) {
    case 'LOSE_WEIGHT':
    case 'LOSE_FAT':
      return 'Fat Loss';
    case 'GAIN_MUSCLE':
    case 'GAIN_WEIGHT':
      return 'Muscle Gain';
    case 'MAINTAIN_HEALTH':
    case 'MAINTAIN_ATHLETIC':
      return 'Stay Fit';
    case 'RECOMPOSITION':
      return 'Recomposition';
    default:
      return 'Stay Fit';
  }
}

export function computeProfileAnalysis(profile: UserProfile): AnalysisResult {
  // Fallbacks
  const weight = Number(profile.weight) || 70;      // kg
  const height = Number(profile.height) || 170;     // cm
  const age = (deriveAge(profile) ?? Number(profile.age)) || 25;
  const gender = profile.gender as Gender | undefined;

  // BMR and TDEE using trusted formulas (Mifflin-St Jeor + activity multipliers)
  const bmr = mifflinStJeorBMR({ gender, weight, height, age });
  const tdee = bmr * getActivityMultiplier(profile.activityLevel);

  // Determine daily calorie target based on goal and weekly target
  const goalLabel = goalToLabel(profile.goal);

  // Weekly goal in kg/week (positive magnitude)
  const weeklyRate = Math.max(0, Number(profile.weeklyGoal) || 0.5); // default safe rate
  // Energy equivalent: ~7700 kcal per kg fat
  const dailyDeltaFromWeekly = (weeklyRate * 7700) / 7; // kcal/day

  let targetCalories = tdee;
  switch (profile.goal) {
    case 'LOSE_WEIGHT':
    case 'LOSE_FAT':
      targetCalories = tdee - dailyDeltaFromWeekly;
      break;
    case 'GAIN_MUSCLE':
    case 'GAIN_WEIGHT':
      targetCalories = tdee + dailyDeltaFromWeekly;
      break;
    case 'RECOMPOSITION':
      // Mild adjustment around maintenance depending on body fat (if provided)
      if ((profile.bodyFatPercentage ?? 0) > 18) {
        targetCalories = tdee * 0.95; // slight deficit
      } else {
        targetCalories = tdee * 1.05; // slight surplus
      }
      break;
    case 'MAINTAIN_HEALTH':
    case 'MAINTAIN_ATHLETIC':
    default:
      targetCalories = tdee; // maintenance
  }

  // Macros
  // Protein: 1.6–2.2 g/kg; choose higher for fat loss
  const proteinPerKg = (profile.goal === 'LOSE_WEIGHT' || profile.goal === 'LOSE_FAT') ? 2.2 : 1.8;
  const protein = Math.round(proteinPerKg * weight);

  // Fat: 20–30% of calories; choose midpoint 25%
  const fatKcal = Math.max(0, targetCalories * 0.25);
  const fat = Math.round(fatKcal / 9);

  // Carbs: remaining calories
  const remainingKcal = Math.max(0, targetCalories - (protein * 4) - (fat * 9));
  const carbs = Math.round(remainingKcal / 4);

  // Estimated weeks to target if targetWeight provided
  const currentWeight = weight;
  const targetWeight = Number(profile.targetWeight);
  let estimatedWeeks = 0;
  if (!isNaN(targetWeight)) {
    const diff = Math.abs(targetWeight - currentWeight);
    const weekly = weeklyRate > 0 ? weeklyRate : 0.5;
    estimatedWeeks = Math.ceil(diff / weekly);
  }

  return {
    goal: goalLabel,
    calories: Math.round(targetCalories),
    metabolism: Math.round(bmr),
    protein,
    carbs,
    fat,
    estimatedWeeks,
  };
}
