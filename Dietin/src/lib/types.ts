export type ActivityLevel = 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'EXTRA_ACTIVE';
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type WorkoutDays = 2 | 3 | 4 | 5 | 6;
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type Budget = 'BASIC' | 'STANDARD' | 'PREMIUM';
export type DietType = 'CLASSIC' | 'PESCATARIAN' | 'VEGETARIAN' | 'VEGAN';
export type Source = 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE' | 'GOOGLE' | 'TV' | 'FRIEND';
export type Goal = 'LOSE_WEIGHT' | 'LOSE_FAT' | 'RECOMPOSITION' | 'MAINTAIN_HEALTH' | 'MAINTAIN_ATHLETIC' | 'GAIN_MUSCLE' | 'GAIN_WEIGHT';
export type Obstacle = 'CONSISTENCY' | 'EATING' | 'SUPPORT' | 'SCHEDULE' | 'INSPIRATION';
export type UserGoal = 'HEALTH' | 'ENERGY' | 'MOTIVATION' | 'CONFIDENCE';

export interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  age?: number;
  gender?: Gender;
  weight?: number;
  height?: number;
  heightFt?: number;
  heightIn?: number;
  bodyFatPercentage?: number;
  activityLevel?: ActivityLevel;
  experienceLevel?: ExperienceLevel;
  workoutDays?: WorkoutDays;
  injuries?: string[];
  allergies?: string[];
  budget?: Budget;
  onboardingCompleted?: boolean;
  createdAt?: string;
  calorieGoal?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
  metabolism?: number;
  profilePicture?: string;
  isPro?: boolean;
  proExpiryDate?: string;
  lastUpdated?: string;
  redeemCode?: string;
  username: string;
  birthMonth?: string;
  birthDay?: number;
  birthYear?: number;
  targetWeight?: number;
  weeklyGoal?: number;
  diet?: DietType;
  // New: user's regional/cuisine preference for personalized suggestions
  regionPreference?: string;
  goal?: Goal;
  goals?: UserGoal[];
  obstacles?: Obstacle[];
  source?: Source;
  hasTriedOtherApps?: 'YES' | 'NO';
}

export interface NutritionAnalysis {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
  warning?: string;
}

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
  warning?: string;
}

export interface NewFood {
  description: string;
  mealTag: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
}
