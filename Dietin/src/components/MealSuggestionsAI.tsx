import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { genAI } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from 'react-i18next';

import {
  AlertTriangle,
  Apple,
  Award,
  Bed,
  Bell,
  Brain,
  Calendar,
  Carrot,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Coffee,
  Crown,
  DollarSign,
  Download,
  Droplets,
  Edit,
  Egg,
  Filter,
  Fish,
  Flag,
  Flame,
  Gift,
  Heart,
  HelpCircle,
  Home,
  Image,
  Info,
  Leaf,
  Map,
  Medal,
  Milk,
  Moon,
  Pin,
  Pizza,
  RefreshCw,
  Salad,
  Save,
  Scale,
  Search,
  Settings,
  Share,
  ShoppingBag,
  Smile,
  Soup,
  Sparkles,
  Star,
  Sun,
  Thermometer,
  ThumbsUp,
  Timer,
  Trash,
  Trophy,
  Truck,
  Utensils,
  X,
  XCircle,
  Youtube,
  Zap,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { useMealStore, MealSuggestion as MealSuggestionType } from "@/stores/mealStore";
import NavHide from './NavHide';
import ProFeatures from "./ProFeatures";
import { useUserStore } from "@/stores/userStore";
import ProSubscriptionPanel from "./ProSubscriptionPanel";
import { createPortal } from 'react-dom';

interface MealSuggestionsAIProps {
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  currentTime: Date;
  budget?: string;
}

interface DetailedRecipe {
  ingredients: string[];
  steps: string[];
  tips: string[];
  youtubeLink?: string;
  image?: string;
}

interface EnhancedRecipeDetails extends DetailedRecipe {
  difficulty_details?: {
    level: string;
    explanation: string;
    tips_for_level: string[];
  };
  nutrition_insights?: {
    calories_breakdown: string;
    protein_quality: string;
    carbs_type: string;
    fats_composition: string;
  };
  cooking_insights?: {
    best_techniques: string[];
    common_mistakes: string[];
    pro_chef_secrets: string[];
  };
  timing_guide?: {
    prep_time: string;
    cook_time: string;
    resting_time: string;
    total_time: string;
  };
}

interface LoadingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  substeps: {
    label: string;
    status: 'pending' | 'loading' | 'complete' | 'error';
  }[];
}

interface LoadingState {
  recipe: boolean;
  insights: boolean;
  image: boolean;
  video: boolean;
  nutrition: boolean;
  timing: boolean;
  tips: boolean;
  ingredients: boolean;
}

interface RecipeRating {
  overall: number;
  taste: number;
  difficulty: number;
  presentation: number;
  reviews: RecipeReview[];
}

interface RecipeReview {
  id: string;
  user: string;
  rating: number;
  comment: string;
  date: Date;
  likes: number;
  images?: string[];
}

interface CookingTip {
  id: string;
  category: 'beginner' | 'intermediate' | 'advanced';
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface NutritionDetail {
  name: string;
  amount: number;
  unit: string;
  percentage: number;
  icon: React.ReactNode;
  color: string;
}

interface CookingStep {
  id: string;
  title: string;
  description: string;
  duration: number;
  tips: string[];
  warnings: string[];
  images?: string[];
  video?: string;
}

interface IngredientDetail {
  id: string;
  name: string;
  amount: number;
  unit: string;
  substitutes: string[];
  nutritionPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  allergens: string[];
  icon: React.ReactNode;
}

interface RecipeVariation {
  id: string;
  name: string;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  difficulty: string;
  time: string;
  calories: number;
}

interface CookingEquipment {
  id: string;
  name: string;
  required: boolean;
  alternatives: string[];
  icon: React.ReactNode;
}

interface TimingBreakdown {
  prep: {
    duration: number;
    tasks: string[];
  };
  cook: {
    duration: number;
    stages: {
      name: string;
      duration: number;
      temperature?: number;
    }[];
  };
  rest: {
    duration: number;
    reason: string;
  };
}

interface ServingSuggestion {
  id: string;
  title: string;
  description: string;
  pairings: string[];
  presentation: string[];
  image?: string;
}

interface StorageInfo {
  fresh: {
    duration: number;
    method: string;
  };
  refrigerated: {
    duration: number;
    method: string;
  };
  frozen: {
    duration: number;
    method: string;
  };
  reheating: string[];
}

interface ShoppingList {
  essentials: {
    name: string;
    amount: number;
    unit: string;
  }[];
  optional: {
    name: string;
    amount: number;
    unit: string;
  }[];
  equipment: string[];
}

interface GlowEffect {
  radius: number;
  color: string;
  opacity: number;
}

interface ParticleEffect {
  size: number;
  speed: number;
  color: string;
}

const generateGlowEffect = (effect: GlowEffect) => {
  return `0 0 ${effect.radius}px rgba(${effect.color}, ${effect.opacity})`;
};

const generateParticleAnimation = (particle: ParticleEffect) => {
  // Particle animation implementation
};

const GlowingBorder: React.FC<{ color: string; intensity?: number }> = ({ color, intensity = 1 }) => (
  <div className="absolute inset-0 rounded-xl" style={{
    background: `linear-gradient(45deg, ${color}${Math.round(intensity * 20)} 0%, transparent 100%)`,
    filter: 'blur(8px)',
    opacity: 0.5
  }} />
);

const AnimatedGradientBorder: React.FC = () => (
  <div className="absolute inset-0 rounded-xl overflow-hidden">
    <div className="absolute inset-0 animate-gradient-xy bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20" />
  </div>
);

const NutritionChart: React.FC<{ data: NutritionDetail[] }> = ({ data }) => (
  <div className="relative p-4 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5">
    <div className="grid grid-cols-2 gap-4">
      {data.map((item, index) => (
        <motion.div
          key={item.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg" />
          <div className="relative p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-600">{item.amount}{item.unit}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.percentage}%` }}
                transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                className={`h-full rounded-full ${item.color}`}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const CookingStepCard: React.FC<{ step: CookingStep; index: number }> = ({ step, index }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-xl" />
      <div className="relative p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-medium">
            {index + 1}
          </div>
          <h4 className="text-base font-medium text-gray-900">{step.title}</h4>
        </div>
        <p className="text-sm text-gray-800 ml-11">{step.description}</p>
        {step.tips.length > 0 && (
          <div className="ml-11 space-y-2">
            {step.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-800">
                <Sparkles className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
                  {tip}
                </p>
              </div>
            ))}
          </div>
        )}
        {step.warnings.length > 0 && (
          <div className="ml-11 space-y-2">
            {step.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
                  {warning}
                </p>
              </div>
            ))}
          </div>
        )}
        {step.duration > 0 && (
          <div className="ml-11 flex items-center gap-2 text-xs text-gray-800">
            <Clock className="h-4 w-4" />
            <span className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
              {step.duration} {t('units.min', 'min')}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const IngredientCard: React.FC<{ ingredient: IngredientDetail }> = ({ ingredient }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-xl" />
      <div className="relative p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/10">
              {ingredient.icon}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">{ingredient.name}</h4>
              <p className="text-xs text-gray-600">
                {ingredient.amount} {ingredient.unit}
              </p>
            </div>
          </div>
          {ingredient.allergens.length > 0 && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">
              Contains Allergens
            </Badge>
          )}
        </div>
        {ingredient.substitutes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-800">{t('mealAI.substitutes', 'Substitutes')}:</p>
            <div className="flex flex-wrap gap-2">
              {ingredient.substitutes.map((sub, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-xs bg-white/5 hover:bg-white/10"
                >
                  {sub}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const MealSuggestionsAI: React.FC<MealSuggestionsAIProps> = ({
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  currentTime,
  budget = "moderate"
}) => {
  const { suggestions, setSuggestions, lastUpdated, lastMealType, setLastMealType } = useMealStore();
  const { user } = useUserStore();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealSuggestionType | null>(null);
  const [detailedRecipe, setDetailedRecipe] = useState<DetailedRecipe | null>(null);
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [enhancedUI, setEnhancedUI] = useState({
    gradients: false,
    particles: false,
    animations: false,
    effects: false
  });
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    {
      id: 'recipe',
      label: t('mealAI.loading.recipe.label', 'Analyzing Recipe'),
      icon: <ChefHat className="h-5 w-5 text-blue-500" />,
      color: 'text-blue-500',
      substeps: [
        { label: t('mealAI.loading.recipe.gatherIngredients', 'Gathering ingredients'), status: 'pending' },
        { label: t('mealAI.loading.recipe.calculatePortions', 'Calculating portions'), status: 'pending' },
        { label: t('mealAI.loading.recipe.optimizeSteps', 'Optimizing cooking steps'), status: 'pending' }
      ]
    },
    {
      id: 'insights',
      label: t('mealAI.loading.insights.label', 'Gathering Insights'),
      icon: <Brain className="h-5 w-5 text-purple-500" />,
      color: 'text-purple-500',
      substeps: [
        { label: t('mealAI.loading.insights.nutritionAnalysis', 'Analyzing nutritional value'), status: 'pending' },
        { label: t('mealAI.loading.insights.techniqueEvaluation', 'Evaluating cooking techniques'), status: 'pending' },
        { label: t('mealAI.loading.insights.proTips', 'Generating pro tips'), status: 'pending' }
      ]
    },
    {
      id: 'visualization',
      label: t('mealAI.loading.visualization.label', 'Creating Visualization'),
      icon: <Image className="h-5 w-5 text-green-500" />,
      color: 'text-green-500',
      substeps: [
        { label: t('mealAI.loading.visualization.styling', 'Composing food styling'), status: 'pending' },
        { label: t('mealAI.loading.visualization.generatingImage', 'Generating image'), status: 'pending' },
        { label: t('mealAI.loading.visualization.enhancing', 'Enhancing details'), status: 'pending' }
      ]
    },
    {
      id: 'tutorial',
      label: t('mealAI.loading.tutorial.label', 'Finding Tutorial'),
      icon: <Youtube className="h-5 w-5 text-red-500" />,
      color: 'text-red-500',
      substeps: [
        { label: t('mealAI.loading.tutorial.searching', 'Searching video content'), status: 'pending' },
        { label: t('mealAI.loading.tutorial.validating', 'Validating quality'), status: 'pending' },
        { label: t('mealAI.loading.tutorial.preparingLink', 'Preparing link'), status: 'pending' }
      ]
    }
  ]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerationStep, setCurrentGenerationStep] = useState('');
  const [loadingStates, setLoadingStates] = useState<LoadingState>({
    recipe: false,
    insights: false,
    image: false,
    video: false,
    nutrition: false,
    timing: false,
    tips: false,
    ingredients: false
  });
  const [recipeRating, setRecipeRating] = useState<RecipeRating | null>(null);
  const [cookingSteps, setCookingSteps] = useState<CookingStep[]>([]);
  const [ingredientDetails, setIngredientDetails] = useState<IngredientDetail[]>([]);
  const [nutritionDetails, setNutritionDetails] = useState<NutritionDetail[]>([]);
  const [recipeVariations, setRecipeVariations] = useState<RecipeVariation[]>([]);
  const [cookingEquipment, setCookingEquipment] = useState<CookingEquipment[]>([]);
  const [timingBreakdown, setTimingBreakdown] = useState<TimingBreakdown | null>(null);
  const [servingSuggestions, setServingSuggestions] = useState<ServingSuggestion[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const [isDragging, setIsDragging] = useState(false);

  // Example meals for non-pro users
  const EXAMPLE_MEALS = [
    {
      name: t('mealAI.examples.grilledChickenSalad.name', 'Grilled Chicken Salad'),
      description: t('mealAI.examples.grilledChickenSalad.desc', 'Fresh mixed greens with grilled chicken breast'),
      calories: 350,
      protein: 32,
      carbs: 12,
      fat: 18,
      type: t('diet.tags.lunch', 'Lunch'),
      difficulty: t('mealAI.difficulty.easy', 'Easy'),
      timeToMake: `20 ${t('units.min', 'min')}`,
      budget: '€€'
    },
    {
      name: t('mealAI.examples.proteinSmoothieBowl.name', 'Protein Smoothie Bowl'),
      description: t('mealAI.examples.proteinSmoothieBowl.desc', 'Protein-rich smoothie with mixed berries and nuts'),
      calories: 280,
      protein: 24,
      carbs: 28,
      fat: 12,
      type: t('diet.tags.breakfast', 'Breakfast'),
      difficulty: t('mealAI.difficulty.easy', 'Easy'),
      timeToMake: `10 ${t('units.min', 'min')}`,
      budget: '€'
    }
  ];

  const getMealType = useCallback((hour: number) => {
    if (hour >= 5 && hour < 11) return 'Breakfast';
    if (hour >= 11 && hour < 15) return 'Lunch';
    if (hour >= 15 && hour < 18) return 'Snack';
    return 'Dinner';
  }, []);

  const shouldRefreshMeals = useCallback(() => {
    if (!lastUpdated) return true;

    const now = new Date();
    const lastUpdate = new Date(lastUpdated);
    const currentMealType = getMealType(now.getHours());

    // Refresh if:
    // 1. It's been more than 2 hours since last update
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate >= 2) return true;

    // 2. The meal type has changed
    if (currentMealType !== lastMealType) return true;

    return false;
  }, [lastUpdated, lastMealType, getMealType]);

  const generateMealSuggestions = async (retryCount = 0) => {
    setLoading(true);
    try {
      // For non-pro users, don't generate AI suggestions - they'll see static examples via ProFeatures component
      if (!user?.isPro) {
        setLoading(false);
        return;
      }

      if (retryCount > 3) {
        throw new Error('Maximum retry attempts reached');
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const currentMealType = getMealType(new Date().getHours());
      const timestamp = Date.now();
      const randomSeed = Math.floor(Math.random() * 1000000);
      const currentHour = new Date().getHours();

      // Extract user data for personalized suggestions
      const u: any = user || {};
      const dietType = (u.diet && typeof u.diet === 'string') ? u.diet : 'CLASSIC';
      const allergiesText = Array.isArray(u.allergies) && u.allergies.length ? u.allergies.join(', ') : 'None';
      const userAge = u.age || 'Not specified';
      const userWeight = u.weight || 'Not specified';
      const userHeight = u.height || 'Not specified';
      const userGoals = u.fitnessGoals || 'General health';
      const activityLevel = u.activityLevel || 'Moderate';

      const isArabic = (i18n.language || '').toLowerCase().startsWith('ar');
      const languageInstruction = isArabic
        ? 'IMPORTANT: Reply in Arabic (Egyptian dialect - ar-EG). All STRING VALUES visible to the user (name, difficulty, timeToMake, quickRecipe) MUST be in Arabic script. Do NOT use Latin letters for words. Keep numbers as numbers. Keep all JSON keys exactly as specified in English.'
        : 'IMPORTANT: Reply in English. All STRING VALUES must be in English. Keep numbers as numbers. Keep all JSON keys exactly as specified.';

      // Determine calorie context for appropriate suggestions
      let calorieContext = 'moderate';
      if (remainingCalories < 200) {
        calorieContext = 'very_low';
      } else if (remainingCalories < 500) {
        calorieContext = 'low';
      } else if (remainingCalories > 1000) {
        calorieContext = 'high';
      } else if (remainingCalories > 1500) {
        calorieContext = 'very_high';
      }

      // Get recent meals for context from the meal store (use getState to avoid hook usage here)
      const { suggestions: recentMealSuggestions } = useMealStore.getState();
      const recentMeals = recentMealSuggestions.slice(-10).map(meal => `${meal.name} (${meal.calories} cal)`).join(', ');
      const mealHistoryContext = recentMeals ? `Recent meals: ${recentMeals}` : 'No recent meals logged';

      // Time-based meal suggestions
      let timeBasedGuidance = '';
      if (currentHour >= 5 && currentHour < 11) {
        timeBasedGuidance = 'breakfast foods like oatmeal, eggs, toast, fruit, yogurt';
      } else if (currentHour >= 11 && currentHour < 16) {
        timeBasedGuidance = 'lunch foods like sandwiches, salads, soups, rice bowls';
      } else if (currentHour >= 16 && currentHour < 21) {
        timeBasedGuidance = 'dinner foods like pasta, stir-fries, grilled proteins, vegetables';
      } else {
        timeBasedGuidance = calorieContext === 'very_low' || calorieContext === 'low'
          ? 'light snacks like fruits, nuts, yogurt'
          : 'evening meals or substantial snacks';
      }

      // Use simple history of names to avoid repetition across sessions
      const historyKey = 'meal_history_names';
      let recentNames: string[] = [];
      try { recentNames = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch { }

      // Create the meal generation prompt focusing on user's data and simple home food with quantities
      const prompt = `${languageInstruction}

You are a strict meal planning assistant. Generate 3 DIFFERENT simple HOME FOODS (not restaurant meals), tailored to the user's remaining macros and time of day.

User Information:
- Remaining calories: ${remainingCalories}
- Remaining protein: ${remainingProtein}g
- Remaining carbs: ${remainingCarbs}g
- Remaining fat: ${remainingFat}g
- Diet type: ${dietType}
- Allergies: ${allergiesText}
- Age: ${userAge}
- Weight: ${userWeight}
- Height: ${userHeight}
- Fitness goals: ${userGoals}
- Activity level: ${activityLevel}
- Budget: ${budget || 'moderate'}
- Current time: ${currentHour}:00 (${currentMealType})

${mealHistoryContext}
Avoid repeating any of these names: ${recentNames.join(' | ') || 'None'}

Calorie context: ${calorieContext}
Time-based guidance: Focus on ${timeBasedGuidance}

STRICT RULES:
1) OUTPUT STYLE: Use common foods with explicit quantities in the name, like "2 eggs + 1 avocado + 1 slice whole wheat toast" or "200g grilled chicken + 150g rice + salad".
2) NO restaurant dishes, NO gourmet words, NO sauces/brands/chef names. Just everyday foods and standard seasonings.
3) Use only basic home methods: baking, sautéing, steaming, boiling, grilling, roasting, stir-frying.
4) Adjust portions to fit remaining macros. If calories are very low, output light options; if very high, output substantial options.
5) Respect diet and allergies. No haram items (no pork, no alcohol).
6) Names MUST be <= 30 chars and contain only simple words, numbers, and '+' separators.
7) Make each of the 3 outputs meaningfully different from each other and from recentNames.
8) quickRecipe must be a very short how-to (<= 100 chars).
9) cuisine MUST be exactly "Home cooking".

Return EXACTLY 3 items in this JSON format (no extra text):
[
  {
    "name": "ingredient list with quantities (<=30 chars)",
    "type": "${currentMealType}",
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "difficulty": "Easy" | "Medium",
    "timeToMake": "X minutes",
    "budget": "€" | "€€",
    "quickRecipe": "Very short instructions (<=100 chars)",
    "cuisine": "Home cooking"
  }
]`

      setCurrentGenerationStep(t('mealAI.steps.gatheringInsights', 'Gathering insights and generating suggestions...'));
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean up the response text and ensure it starts with [ and ends with ]
      const cleanJson = text.replace(/```json\n|\n```|```/g, '').trim();
      if (!cleanJson.startsWith('[') || !cleanJson.endsWith(']')) {
        throw new Error('Invalid JSON format received');
      }

      try {
        const newSuggestions = JSON.parse(cleanJson) as MealSuggestionType[];

        // Validate the response structure
        if (!Array.isArray(newSuggestions) || newSuggestions.length !== 3) {
          throw new Error('Invalid response format');
        }

        // Validate each meal object has required properties
        newSuggestions.forEach((meal, index) => {
          const requiredStringProps = ['name', 'type', 'difficulty', 'timeToMake', 'budget', 'quickRecipe', 'cuisine'];
          const requiredNumericProps = ['calories', 'protein', 'carbs', 'fat'];

          // Check string properties (must be truthy)
          for (const prop of requiredStringProps) {
            if (!meal[prop as keyof MealSuggestionType]) {
              throw new Error(`Missing required property '${prop}' in meal ${index + 1}`);
            }
          }

          // Check numeric properties (must be defined and >= 0)
          for (const prop of requiredNumericProps) {
            const value = meal[prop as keyof MealSuggestionType];
            if (typeof value !== 'number' || value < 0) {
              throw new Error(`Invalid or missing numeric property '${prop}' in meal ${index + 1}`);
            }
          }
        });

        // Enforce home budget only (reject luxury "€€€")
        const hasLuxury = newSuggestions.some(m => (m.budget || '').trim() === '€€€');
        if (hasLuxury) {
          throw new Error('AI returned luxury-budget meals. Retrying with stricter constraints...');
        }

        // Since we're using "Home cooking" as cuisine, no cuisine validation needed

        // Reject gourmet/premium keywords in meal name or quick recipe
        const forbiddenMealKeywords = ['wagyu', 'truffle', 'caviar', 'foie gras', 'gold', 'gold leaf', 'molecular', 'kobe', 'duck', 'بط'];
        const hasGourmet = newSuggestions.some(m =>
          forbiddenMealKeywords.some(term => (`${m.name || ''} ${m.quickRecipe || ''}`).toLowerCase().includes(term))
        );
        if (hasGourmet) {
          throw new Error('AI returned gourmet/premium items. Retrying...');
        }

        // Enforce Arabic script for values when Arabic UI is active
        if (isArabic) {
          const latinRegex = /[A-Za-z]/;
          const hasLatin = newSuggestions.some(m =>
            latinRegex.test(m.name || '') || latinRegex.test(m.quickRecipe || '')
          );
          if (hasLatin) {
            throw new Error('AI returned non-Arabic visible text while Arabic is active. Retrying...');
          }
        }

        // Enforce simple food-style names with quantities and '+' separators, max 30 chars
        const nameInvalid = newSuggestions.some(m => {
          const n = (m.name || '').trim();
          if (!n) return true;
          if (n.length > 30) return true;
          // Must include at least one number and a '+' separator to indicate quantities and components
          const hasNumber = /\d/.test(n);
          const hasPlus = /\+/.test(n);
          return !(hasNumber && hasPlus);
        });
        if (nameInvalid) {
          throw new Error('AI returned names without quantities/+ separators. Retrying...');
        }

        // Prevent repetition: avoid duplicates among themselves or against recent history
        const names = newSuggestions.map(m => (m.name || '').trim());
        const internalDup = new Set(names).size !== names.length;
        const historyDup = names.some(n => (recentNames || []).includes(n));
        if (internalDup || historyDup) {
          throw new Error('AI returned repeated names. Retrying for variety...');
        }

        // Debug: log parsed suggestions before setting state
        try {
          // eslint-disable-next-line no-console
          console.log('Parsed meal suggestions:', newSuggestions);
        } catch { }
        setLastMealType(currentMealType);
        setSuggestions(newSuggestions);
        // Persist names to history to reduce repetition across sessions
        try {
          const updated = Array.from(new Set([...(recentNames || []), ...names])).slice(-30);
          localStorage.setItem(historyKey, JSON.stringify(updated));
        } catch { }
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Received text:', cleanJson);
        throw new Error('Failed to parse meal suggestions');
      }
    } catch (error) {
      console.error('Error generating meal suggestions:', error);
      setSuggestions([]); // Clear suggestions on error

      // Handle rate limit error
      if (error.toString().includes('429') || error.toString().includes('Too Many Requests')) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff up to 10 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        generateMealSuggestions(retryCount + 1);
      } else if (retryCount < 3) {
        // For other errors, retry with a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        generateMealSuggestions(retryCount + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  // Normalize meal type for i18n lookup
  const normalizeMealType = (type: string) => {
    const t = (type || '').toLowerCase();
    if (["breakfast", "فطار", "الفطور"].includes(t)) return 'breakfast';
    if (["lunch", "غدا", "غداء"].includes(t)) return 'lunch';
    if (["dinner", "عشا", "عشاء"].includes(t)) return 'dinner';
    if (["snack", "سناك", "وجبة خفيفة"].includes(t)) return 'snacks';
    return t || 'breakfast';
  };

  const updateLoadingStep = (stepId: string, substepIndex: number, status: 'pending' | 'loading' | 'complete' | 'error') => {
    setLoadingSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        const newSubsteps = [...step.substeps];
        newSubsteps[substepIndex] = { ...newSubsteps[substepIndex], status };
        return { ...step, substeps: newSubsteps };
      }
      return step;
    }));
  };

  const generateDetailedRecipe = async (meal: MealSuggestionType) => {
    setIsGeneratingDetails(true);
    setGenerationProgress(0);

    try {
      // Recipe Analysis Phase
      setCurrentGenerationStep(t('mealAI.steps.analyzing', 'Analyzing recipe components...'));
      updateLoadingStep('recipe', 0, 'loading');
      setGenerationProgress(10);

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const isArabic = (i18n.language || '').toLowerCase().startsWith('ar');
      const languageInstruction = isArabic
        ? 'IMPORTANT: Reply in Arabic (Egyptian dialect - ar-EG). Keep numbers as numbers. Keep all JSON keys exactly as specified in English.'
        : 'IMPORTANT: Reply in English. Keep numbers as numbers. Keep all JSON keys exactly as specified.';

      const prompt = `${languageInstruction}\n\nGenerate a detailed recipe for: "${meal.name}"
      
      Return a JSON object with these exact properties:
      {
        "ingredients": string[] (list of ingredients with quantities),
        "steps": string[] (detailed cooking steps),
        "tips": string[] (3-5 cooking tips),
        "searchQuery": string (a good YouTube search query for this recipe)
      }
      
      Important: Return ONLY the JSON object, no markdown or code block markers.`;

      updateLoadingStep('recipe', 1, 'loading');
      setGenerationProgress(20);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      updateLoadingStep('recipe', 2, 'loading');
      setGenerationProgress(30);

      // Clean up the response text to ensure valid JSON
      const cleanJson = text.replace(/```json\n|\n```|```/g, '').trim();
      const recipeData = JSON.parse(cleanJson);

      updateLoadingStep('recipe', 0, 'complete');
      updateLoadingStep('recipe', 1, 'complete');
      updateLoadingStep('recipe', 2, 'complete');
      // Skip image generation entirely
      setGenerationProgress(80);

      // YouTube Search Phase
      setCurrentGenerationStep(t('mealAI.steps.findingTutorial', 'Finding video tutorial...'));
      updateLoadingStep('tutorial', 0, 'loading');

      try {
        // Create a simple YouTube search URL with the meal name
        const searchQuery = isArabic ? `طريقة عمل ${meal.name}` : `how to cook ${meal.name} recipe`;
        const encodedQuery = encodeURIComponent(searchQuery);
        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;

        updateLoadingStep('tutorial', 1, 'complete');
        updateLoadingStep('tutorial', 2, 'complete');
        recipeData.youtubeLink = youtubeSearchUrl;
      } catch (error) {
        console.error('Error finding YouTube tutorial:', error);
        updateLoadingStep('tutorial', 0, 'error');
        updateLoadingStep('tutorial', 1, 'error');
        updateLoadingStep('tutorial', 2, 'error');
        recipeData.youtubeLink = undefined;
      }

      setGenerationProgress(100);

      // Create the final recipe data object
      const finalRecipeData: DetailedRecipe = {
        ingredients: recipeData.ingredients || [],
        steps: recipeData.steps || [],
        tips: recipeData.tips || [],
        youtubeLink: recipeData.youtubeLink || undefined,
        image: recipeData.image
      };

      // Set the detailed recipe
      setDetailedRecipe(finalRecipeData);

    } catch (error) {
      console.error('Error generating recipe details:', error);
      setDetailedRecipe(null);
      // Mark all remaining steps as error
      loadingSteps.forEach(step => {
        step.substeps.forEach((substep, index) => {
          if (substep.status === 'pending' || substep.status === 'loading') {
            updateLoadingStep(step.id, index, 'error');
          }
        });
      });
    } finally {
      setIsGeneratingDetails(false);
    }
  };

  const handleMealClick = async (meal: MealSuggestionType) => {
    setSelectedMeal(meal);
    if (!detailedRecipe) {
      await generateDetailedRecipe(meal);
    }
  };

  // Check for updates every minute
  useEffect(() => {
    const checkForUpdates = () => {
      if (shouldRefreshMeals() && !loading) {
        generateMealSuggestions();
      }
    };

    // Initial check
    checkForUpdates();

    // Set up interval
    const interval = setInterval(checkForUpdates, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [shouldRefreshMeals, loading]);

  useEffect(() => {
    if (loading) {
      setIsBlurred(true);
    } else {
      // Delay removing blur to allow content to settle
      const timer = setTimeout(() => setIsBlurred(false), 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (selectedMeal || isGeneratingDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedMeal, isGeneratingDetails]);

  // Normalize difficulty to handle both English and Arabic labels
  const normalizeDifficulty = (difficulty: string) => {
    const d = (difficulty || '').toLowerCase();
    if (['easy', 'سهل'].includes(d)) return 'easy';
    if (['medium', 'متوسط'].includes(d)) return 'medium';
    if (['hard', 'صعب'].includes(d)) return 'hard';
    return 'other';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (normalizeDifficulty(difficulty)) {
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Translate meal type badge for display based on common types
  const translateMealType = (type: string) => {
    const v = (type || '').toLowerCase();
    if (v.includes('breakfast')) return t('diet.tags.breakfast', 'Breakfast');
    if (v.includes('lunch')) return t('diet.tags.lunch', 'Lunch');
    if (v.includes('snack')) return t('diet.tags.snack', 'Snack');
    if (v.includes('dinner')) return t('diet.tags.dinner', 'Dinner');
    return type;
  };

  // renderMealContent component
  const renderMealContent = (meal: MealSuggestionType, index: number) => (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      onClick={() => handleMealClick(meal)}
      className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-5 cursor-pointer transform hover:-translate-y-0.5"
    >
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
        <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
      </div>
      <div className="relative flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1">{meal.name}</h3>
          <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
            {translateMealType(meal.type)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "flex items-center gap-1 text-xs",
              normalizeDifficulty(meal.difficulty) === 'easy' && "bg-green-500/10 text-green-600",
              normalizeDifficulty(meal.difficulty) === 'medium' && "bg-yellow-500/10 text-yellow-600",
              normalizeDifficulty(meal.difficulty) === 'hard' && "bg-red-500/10 text-red-600"
            )}
          >
            {t(`mealAI.difficulty.${normalizeDifficulty(meal.difficulty)}`, meal.difficulty)}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200 bg-white/50">
            <Timer className="h-3 w-3" />
            {meal.timeToMake}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200 bg-white/50">
            <DollarSign className="h-3 w-3" />
            {(meal as any).budget ?? budget}
          </Badge>
        </div>

        <p className="text-sm text-gray-500 line-clamp-2 text-ellipsis">
          {meal.quickRecipe}
        </p>
      </div>
    </motion.div>
  );

  const resetRecipeState = () => {
    setDetailedRecipe(null);
    setIsGeneratingDetails(false);
    setGenerationProgress(0);
    setCurrentGenerationStep('');
  };

  // Add new functions for enhanced features
  const handleRatingSubmit = (rating: number, comment: string) => {
    // Rating submission logic...
  };

  const handleVariationSelect = (variation: RecipeVariation) => {
    // Variation selection logic...
  };

  const generateShoppingList = () => {
    // Shopping list generation logic...
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      setSelectedMeal(null);
      resetRecipeState();
    } else {
      y.set(0);
    }
    setIsDragging(false);
  };

  return (
    <div className="relative">
      <NavHide isAIOpen={!!selectedMeal} />

      {/* Title and Refresh Button */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="bg-white shadow-lg border border-black/5 rounded-full px-5 py-3">
          <span className="text-[15px] tracking-[-0.01em] font-sf-display text-gray-900">{t('mealAI.ui.title', 'Meal Suggestions')}</span>
        </div>
        <ProFeatures>
          <button
            onClick={() => !loading && generateMealSuggestions()}
            className={cn(
              "h-10 w-10 rounded-full bg-gradient-to-r from-[#4776E6] to-[#8E54E9] hover:opacity-90 transition-opacity shadow-lg shadow-[#4776E6]/20 border-0 p-0 flex items-center justify-center",
              loading && "opacity-50 cursor-not-allowed"
            )}
            disabled={loading}
          >
            <RefreshCw className={cn("h-5 w-5 text-white", loading && "animate-spin")} />
          </button>
        </ProFeatures>
      </div>

      {/* Content Area */}
      <div className="space-y-2">
        <ProFeatures>
          {/* Pro user content */}
          {suggestions.length === 0 && !loading ? (
            <div className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-6 cursor-pointer transform hover:-translate-y-0.5">
              <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
                <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
              </div>
              <div className="relative">
                <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-900 font-medium">{t('mealAI.ui.refreshTitle', 'Refresh for meal suggestions')}</p>
                <p className="text-gray-600 text-sm mt-1">{t('mealAI.ui.refreshSubtitle', 'Get personalized meal recommendations')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.map((meal, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  onClick={() => handleMealClick(meal)}
                  className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-5 cursor-pointer transform hover:-translate-y-0.5"
                >
                  <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
                    <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
                  </div>
                  <div className="relative flex flex-col gap-3">
                    <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1">{meal.name}</h3>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          normalizeDifficulty(meal.difficulty) === 'easy' && "bg-green-500/10 text-green-600",
                          normalizeDifficulty(meal.difficulty) === 'medium' && "bg-yellow-500/10 text-yellow-600",
                          normalizeDifficulty(meal.difficulty) === 'hard' && "bg-red-500/10 text-red-600"
                        )}
                      >
                        {t(`mealAI.difficulty.${normalizeDifficulty(meal.difficulty)}`, meal.difficulty)}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                        <Timer className="h-3 w-3" />
                        {meal.timeToMake}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                        <DollarSign className="h-3 w-3" />
                        {meal.budget}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ProFeatures>

        <ProFeatures showOnlyForNonPro>
          {/* Non-pro user content */}
          <div className="space-y-2">
            {EXAMPLE_MEALS.map((meal, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-5 cursor-pointer transform hover:-translate-y-0.5"
              >
                <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
                  <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
                </div>
                <div className="relative flex flex-col gap-3">
                  <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1">{meal.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        normalizeDifficulty(meal.difficulty) === 'easy' && "bg-green-500/10 text-green-600",
                        normalizeDifficulty(meal.difficulty) === 'medium' && "bg-yellow-500/10 text-yellow-600",
                        normalizeDifficulty(meal.difficulty) === 'hard' && "bg-red-500/10 text-red-600"
                      )}
                    >
                      {t(`mealAI.difficulty.${normalizeDifficulty(meal.difficulty)}`, meal.difficulty)}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                      <Timer className="h-3 w-3" />
                      {meal.timeToMake}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                      <DollarSign className="h-3 w-3" />
                      {meal.budget || t('mealAI.ui.budgetModerate', 'Moderate')}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
            <motion.div
              onClick={() => setIsProPanelOpen(true)}
              className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-5 cursor-pointer transform hover:-translate-y-0.5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: EXAMPLE_MEALS.length * 0.1 }}
            >
              <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
                <div className="absolute inset-0 bg-gradient-conic-moving from-blue-500/10 via-purple-500/10 to-pink-300/10" />
              </div>
              <div className="relative flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <p className="text-gray-900 text-sm font-medium">{t('mealAI.ui.subscribeCta', 'Subscribe to DietinPro for AI meal suggestions')}</p>
              </div>
            </motion.div>
          </div>
        </ProFeatures>
      </div>

      {/* Recipe Popup */}
      {createPortal(
        <AnimatePresence mode="wait">
          {selectedMeal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
                onClick={() => {
                  setSelectedMeal(null);
                  resetRecipeState();
                }}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{
                  type: "spring",
                  damping: 40,
                  stiffness: 300,
                  mass: 0.8
                }}
                drag="y"
                dragDirectionLock
                dragElastic={0.4}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragMomentum={false}
                onDrag={(event, info) => {
                  if (info.offset.y < 0) {
                    y.set(0);
                  }
                }}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                style={{ y }}
                className="fixed bottom-0 left-0 right-0 z-[99999] touch-none select-none"
              >
                <div className="bg-white rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] h-[85vh] relative flex flex-col">
                  <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                  </div>
                  <div className={cn(
                    "flex-1 overflow-y-auto overscroll-contain px-6 py-4",
                    isDragging && "pointer-events-none"
                  )}>
                    {isGeneratingDetails ? (
                      <div className="space-y-8 py-12">
                        <div className="flex flex-col items-center space-y-6">
                          <div className="relative">
                            <div className="absolute -inset-8 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-full blur-2xl animate-pulse" />
                            <div className="relative w-32 h-32">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div
                                  animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 180, 360]
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear"
                                  }}
                                  className="relative"
                                >
                                  <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-lg animate-pulse" />
                                  <Sparkles className="h-10 w-10 text-blue-400" />
                                </motion.div>
                              </div>
                              <svg className="w-full h-full -rotate-90">
                                <circle
                                  cx="64"
                                  cy="64"
                                  r="60"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  className="text-muted-foreground/20"
                                />
                                <motion.circle
                                  cx="64"
                                  cy="64"
                                  r="60"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  className="text-blue-500"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: generationProgress / 100 }}
                                  transition={{ duration: 0.5, ease: "easeInOut" }}
                                  strokeDasharray="376.99"
                                  strokeDashoffset="376.99"
                                />
                              </svg>
                            </div>
                          </div>
                          <div className="space-y-2 text-center">
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-lg font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
                            >
                              {currentGenerationStep}
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-gray-600"
                            >
                              {Math.round(generationProgress)}% {t('common.complete', 'Complete')}
                            </motion.div>
                          </div>
                          <div className="w-full max-w-md space-y-4">
                            {loadingSteps.map((step, index) => (
                              <motion.div
                                key={step.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative group"
                              >
                                <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "p-2 rounded-full transition-colors",
                                      step.substeps.every(s => s.status === 'complete') ? "bg-green-500/20" :
                                        step.substeps.some(s => s.status === 'loading') ? "bg-blue-500/20" :
                                          "bg-white/10"
                                    )}>
                                      {step.icon}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">{step.label}</span>
                                        <span className="text-xs text-gray-600">
                                          {step.substeps.filter(s => s.status === 'complete').length}/{step.substeps.length}
                                        </span>
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {step.substeps.map((substep, i) => (
                                          <div key={i} className="flex items-center gap-2">
                                            <div className={cn(
                                              "w-1.5 h-1.5 rounded-full transition-colors",
                                              substep.status === 'complete' ? "bg-green-500" :
                                                substep.status === 'loading' ? "bg-blue-500 animate-pulse" :
                                                  substep.status === 'error' ? "bg-red-500" :
                                                    "bg-white/20"
                                            )} />
                                            <span className="text-xs text-gray-600">{substep.label}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : detailedRecipe ? (
                      <div className="space-y-8">
                        {/* Enhanced Recipe Content */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative"
                        >
                          <div className="absolute -inset-x-6 -inset-y-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl blur-xl" />
                          <div className="relative space-y-4">
                            <h2 className="text-3xl font-bold text-gray-900">
                              {selectedMeal.name}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge className="bg-blue-500/10 text-blue-500 px-3 py-1">
                                {t(`categories.${normalizeMealType(selectedMeal.type)}`, selectedMeal.type)}
                              </Badge>
                              <div className="flex items-center gap-2 text-sm text-gray-800">
                                <Clock className="h-4 w-4" />
                                {selectedMeal.timeToMake}
                              </div>
                              <Badge
                                className={cn(
                                  "px-3 py-1",
                                  normalizeDifficulty(selectedMeal.difficulty) === 'easy' && "bg-green-500/10 text-green-600",
                                  normalizeDifficulty(selectedMeal.difficulty) === 'medium' && "bg-yellow-500/10 text-yellow-600",
                                  normalizeDifficulty(selectedMeal.difficulty) === 'hard' && "bg-red-500/10 text-red-600"
                                )}
                              >
                                {t(`mealAI.difficulty.${normalizeDifficulty(selectedMeal.difficulty)}`, selectedMeal.difficulty)}
                              </Badge>
                            </div>
                          </div>
                        </motion.div>

                        {/* Enhanced Image Section */}
                        {detailedRecipe.image && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative aspect-video rounded-xl overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 mix-blend-overlay" />
                            <img
                              src={detailedRecipe.image}
                              alt={selectedMeal.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                          </motion.div>
                        )}

                        {/* Enhanced Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="relative p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/10"
                          >
                            <div className="relative space-y-2">
                              <div className="flex items-center gap-2">
                                <Flame className="h-5 w-5 text-orange-500" />
                                <span className="text-sm font-medium text-gray-900">{t('mealAI.stats.calories', 'Calories')}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900">{selectedMeal.calories}</p>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="relative p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/10"
                          >
                            <div className="relative space-y-2">
                              <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-blue-500" />
                                <span className="text-sm font-medium text-gray-900">{t('mealAI.stats.protein', 'Protein')}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900">{selectedMeal.protein}g</p>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="relative p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/10"
                          >
                            <div className="relative space-y-2">
                              <div className="flex items-center gap-2">
                                <Scale className="h-5 w-5 text-green-500" />
                                <span className="text-sm font-medium text-gray-900">{t('mealAI.stats.carbs', 'Carbs')}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900">{selectedMeal.carbs}g</p>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            className="relative p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/10"
                          >
                            <div className="relative space-y-2">
                              <div className="flex items-center gap-2">
                                <Droplets className="h-5 w-5 text-yellow-500" />
                                <span className="text-sm font-medium text-gray-900">{t('mealAI.stats.fat', 'Fat')}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900">{selectedMeal.fat}g</p>
                            </div>
                          </motion.div>
                        </div>

                        {/* Enhanced Instructions Section */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="space-y-6"
                        >
                          {/* Enhanced Ingredients */}
                          <div className="relative p-6 rounded-xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                            <div className="relative space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-blue-500/10">
                                  <ChefHat className="h-5 w-5 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">{t('mealAI.sections.ingredients', 'Ingredients')}</h3>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {detailedRecipe.ingredients.map((ingredient, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-start gap-3 group"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 group-hover:scale-125 transition-transform" />
                                    <p className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
                                      {ingredient}
                                    </p>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Enhanced Steps */}
                          <div className="relative p-6 rounded-xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
                            <div className="relative space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-purple-500/10">
                                  <Utensils className="h-5 w-5 text-purple-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">{t('mealAI.sections.instructions', 'Instructions')}</h3>
                              </div>
                              <div className="space-y-6">
                                {detailedRecipe.steps.map((step, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex gap-4 group"
                                  >
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center font-medium group-hover:bg-purple-500/20 transition-colors">
                                      {i + 1}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
                                        {step}
                                      </p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Enhanced Pro Tips */}
                          <div className="relative p-6 rounded-xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5" />
                            <div className="relative space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-yellow-500/10">
                                  <Star className="h-5 w-5 text-yellow-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">{t('mealAI.sections.proTips', 'Pro Tips')}</h3>
                              </div>
                              <div className="space-y-4">
                                {detailedRecipe.tips.map((tip, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-start gap-3 group"
                                  >
                                    <div className="flex-shrink-0 mt-1">
                                      <Sparkles className="h-4 w-4 text-yellow-500 group-hover:scale-125 transition-transform" />
                                    </div>
                                    <p className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
                                      {tip}
                                    </p>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Enhanced Video Tutorial */}
                          {detailedRecipe.youtubeLink && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8 }}
                              className="relative"
                            >
                              <a
                                href={detailedRecipe.youtubeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative flex items-center justify-center gap-3 w-full p-4 rounded-xl overflow-hidden bg-gradient-to-br from-red-500/10 to-pink-500/10 hover:from-red-500/20 hover:to-pink-500/20 transition-all"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 group-hover:translate-x-full transition-transform duration-1000" />
                                <Youtube className="h-6 w-6 text-red-500 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition-colors">
                                  {t('mealAI.actions.watchVideo', 'Watch Video Tutorial')}
                                </span>
                              </a>
                            </motion.div>
                          )}
                        </motion.div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        {/* ... existing error content ... */}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Pro Subscription Panel */}
      <ProSubscriptionPanel
        isOpen={isProPanelOpen}
        onClose={() => setIsProPanelOpen(false)}
      />

      {/* Global styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .gradient-animate {
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
        }
        
        .glass-effect {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        
        .text-glow {
          text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
        }
        
        .hover-glow:hover {
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .enhanced-blur {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .enhanced-glow {
          box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
        }

        .enhanced-text {
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
        }

        .gradient-animate {
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
        }

        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .glass-effect {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .text-glow {
          text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
        }

        .hover-glow:hover {
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .enhanced-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        
        .enhanced-text-gradient {
          background: linear-gradient(to right, #fff, rgba(255,255,255,0.8));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        @keyframes gradient-conic-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .bg-gradient-conic-moving {
          background: conic-gradient(from 0deg at 50% 50%,
            var(--tw-gradient-from) 0deg,
            var(--tw-gradient-via) 180deg,
            var(--tw-gradient-to) 360deg
          );
          animation: gradient-conic-spin 8s linear infinite;
        }
        
        /* Add more enhanced styles... */
      `}} />
    </div>
  );
};

export default MealSuggestionsAI;
