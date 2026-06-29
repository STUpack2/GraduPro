import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { genAI } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useHydrationStore, DrinkSuggestion } from "@/stores/hydrationStore";
import NavHide from './NavHide';
import ProFeatures from "./ProFeatures";
import { useUserStore } from "@/stores/userStore";
import ProSubscriptionPanel from "./ProSubscriptionPanel";
import { useTranslation } from 'react-i18next';
// Add missing interfaces
import { createPortal } from 'react-dom';
interface GlowEffect {
  radius: number;
  color: string;
  opacity: number;
}

interface ParticleEffect {
  size: number;
  color: string;
  speed: number;
  quantity: number;
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
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
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
        <div className="ml-11 flex items-center gap-2 text-xs text-gray-600">
          <Clock className="h-4 w-4" />
          <span className="text-sm text-gray-800 group-hover:text-gray-900 transition-colors">
            {step.duration} {t('units.min')}
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
              {t('hydrationAI.containsAllergens')}
            </Badge>
          )}
        </div>
        {ingredient.substitutes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-900">{t('hydrationAI.substitutes')}</p>
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

interface HydrationAIProps {
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  currentTime: Date;
  budget?: string;
  selectedDrink: DrinkSuggestion | null;
  setSelectedDrink: (drink: DrinkSuggestion | null) => void;
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

const HydrationAI: React.FC<HydrationAIProps> = ({
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  currentTime,
  budget = "moderate",
  selectedDrink: externalSelectedDrink,
  setSelectedDrink: externalSetSelectedDrink
}) => {
  const { suggestions, setSuggestions, lastUpdated, lastDrinkType, setLastDrinkType } = useHydrationStore();
  const { user } = useUserStore();
  const { t, i18n } = useTranslation();
  const responseLanguage = i18n.language && i18n.language.startsWith('ar') ? 'Arabic' : 'English';
  const [loading, setLoading] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<DrinkSuggestion | null>(null);
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
      label: t('hydrationAI.loading.steps.analyzingRecipe.title'),
      icon: <ChefHat className="h-5 w-5 text-blue-500" />,
      color: 'text-blue-500',
      substeps: [
        { label: t('hydrationAI.loading.steps.analyzingRecipe.substeps.gatheringIngredients'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.analyzingRecipe.substeps.calculatingPortions'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.analyzingRecipe.substeps.optimizingCookingSteps'), status: 'pending' }
      ]
    },
    {
      id: 'insights',
      label: t('hydrationAI.loading.steps.gatheringInsights.title'),
      icon: <Brain className="h-5 w-5 text-purple-500" />,
      color: 'text-purple-500',
      substeps: [
        { label: t('hydrationAI.loading.steps.gatheringInsights.substeps.analyzingNutritionalValue'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.gatheringInsights.substeps.evaluatingCookingTechniques'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.gatheringInsights.substeps.generatingProTips'), status: 'pending' }
      ]
    },
    {
      id: 'visualization',
      label: t('hydrationAI.loading.steps.creatingVisualization.title'),
      icon: <Image className="h-5 w-5 text-green-500" />,
      color: 'text-green-500',
      substeps: [
        { label: t('hydrationAI.loading.steps.creatingVisualization.substeps.composingFoodStyling'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.creatingVisualization.substeps.generatingImage'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.creatingVisualization.substeps.enhancingDetails'), status: 'pending' }
      ]
    },
    {
      id: 'tutorial',
      label: t('hydrationAI.loading.steps.findingTutorial.title'),
      icon: <Youtube className="h-5 w-5 text-red-500" />,
      color: 'text-red-500',
      substeps: [
        { label: t('hydrationAI.loading.steps.findingTutorial.substeps.searchingVideoContent'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.findingTutorial.substeps.validatingQuality'), status: 'pending' },
        { label: t('hydrationAI.loading.steps.findingTutorial.substeps.preparingLink'), status: 'pending' }
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

  const getDrinkType = useCallback((hour: number) => {
    if (hour >= 5 && hour < 11) return 'Morning';
    if (hour >= 11 && hour < 15) return 'Afternoon';
    if (hour >= 15 && hour < 18) return 'Evening';
    return 'Night';
  }, []);

  const shouldRefreshDrinks = useCallback(() => {
    if (!lastUpdated) return true;

    const now = new Date();
    const lastUpdate = new Date(lastUpdated);
    const currentDrinkType = getDrinkType(now.getHours());
    
    // Refresh if:
    // 1. It's been more than 2 hours since last update
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate >= 2) return true;
    
    // 2. The drink type has changed
    if (currentDrinkType !== lastDrinkType) return true;
    
    return false;
  }, [lastUpdated, lastDrinkType, getDrinkType]);

  const generateDrinkSuggestions = async (retryCount = 0) => {
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
      
      const currentDrinkType = getDrinkType(new Date().getHours());
      const timestamp = Date.now();
      const randomSeed = Math.floor(Math.random() * 1000000);
      
      const prompt = `You are a drink and hydration expert. Generate 3 COMPLETELY DIFFERENT drink suggestions.

      IMPORTANT: ONLY GENERATE DRINKS. NO FOOD OR MEALS ALLOWED.
      Each drink must be a beverage like water, juice, smoothie, tea, coffee, protein shake, etc.

      LANGUAGE REQUIREMENT: The user's UI language is ${responseLanguage}. For all human-readable text fields (name, timeToMake, quickRecipe), write them in ${responseLanguage}. However, KEEP THESE FIELDS IN ENGLISH EXACTLY AS ENUMS: difficulty ("Easy" | "Medium" | "Hard"), type ("${currentDrinkType} Hydration"), and budget ("€" | "€€" | "€€€").

      Return ONLY a JSON array with 3 drink objects. Each object must have EXACTLY these properties:
      {
        "name": string (MUST BE A DRINK NAME, max 30 chars, in ${responseLanguage}),
        "type": "${currentDrinkType} Hydration",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "difficulty": "Easy" | "Medium" | "Hard",
        "timeToMake": string (in ${responseLanguage}),
        "budget": "€" | "€€" | "€€€",
        "quickRecipe": string (max 100 chars, in ${responseLanguage})
      }

      STRICT FORMAT: Output MUST be valid JSON with no extra text, code fences, or explanations.
      Random seed: ${timestamp}-${randomSeed}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean up the response text to ensure valid JSON
      const cleanJson = text.replace(/```json\n|\n```|```/g, '').trim();
      const newSuggestions = JSON.parse(cleanJson) as DrinkSuggestion[];
      
      // Validate the response structure
      if (!Array.isArray(newSuggestions) || newSuggestions.length !== 3) {
        throw new Error('Invalid response format');
      }

      // Validate that suggestions are actually drinks - include Arabic when needed
      const drinkKeywordsEn = [
        'drink', 'juice', 'smoothie', 'tea', 'water', 'shake', 'coffee',
        'latte', 'beverage', 'lemonade', 'punch', 'milk', 'soda', 'chai',
        'espresso', 'frappe', 'mocha', 'brew', 'tonic', 'cider'
      ];
      const drinkKeywordsAr = [
        'مشروب', 'عصير', 'سموذي', 'شاي', 'ماء', 'مياه', 'شيك', 'قهوة',
        'لاتيه', 'مشروب غازي', 'ليمونادة', 'بانش', 'حليب', 'صودا', 'شراب'
      ];

      const hasDrinkKeyword = (text: string) => {
        const lower = (text || '').toLowerCase();
        const ar = responseLanguage === 'Arabic';
        const matchEn = drinkKeywordsEn.some(k => lower.includes(k));
        const matchAr = drinkKeywordsAr.some(k => text.includes(k));
        return ar ? (matchAr || matchEn) : matchEn;
      };

      if (newSuggestions.some(s => !hasDrinkKeyword(s.name) && !hasDrinkKeyword(s.quickRecipe))) {
        console.warn('Retrying due to non-drink suggestions:', newSuggestions);
        throw new Error('Non-drink suggestions detected');
      }
      
      setLastDrinkType(currentDrinkType);
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Error generating drink suggestions:', error);
      setSuggestions([]); // Clear suggestions on error
      
      // Handle rate limit error
      if (error.toString().includes('429') || error.toString().includes('Too Many Requests')) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff up to 10 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
        generateDrinkSuggestions(retryCount + 1);
      } else if (retryCount < 3) {
        // For other errors, retry with a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        generateDrinkSuggestions(retryCount + 1);
      }
    } finally {
      setLoading(false);
    }
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

  const generateDetailedRecipe = async (drink: DrinkSuggestion) => {
    setIsGeneratingDetails(true);
    setGenerationProgress(0);
    
    try {
      // Recipe Analysis Phase
      setCurrentGenerationStep(t('hydrationAI.loading.analyzingRecipe'));
      updateLoadingStep('recipe', 0, 'loading');
      setGenerationProgress(10);
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const prompt = `Generate a detailed recipe for: "${drink.name}"
      
      The user's UI language is ${responseLanguage}. For all human-readable text fields (ingredients, steps, tips, searchQuery), write them in ${responseLanguage}.

      Return ONLY a JSON object with these exact properties:
      {
        "ingredients": string[] (list of ingredients with quantities),
        "steps": string[] (detailed cooking steps),
        "tips": string[] (3-5 cooking tips),
        "searchQuery": string (a good YouTube search query for this recipe)
      }
      
      STRICT FORMAT: Output MUST be valid JSON with no extra text, code fences, or explanations.`;

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
      setGenerationProgress(80);
      
      // YouTube Search Phase
      setCurrentGenerationStep(t('hydrationAI.loading.findingTutorial'));
      updateLoadingStep('tutorial', 0, 'loading');
      
      try {
        // Create a localized YouTube search query with the drink name
        const searchQuery = t('hydrationAI.youtubeSearch', { name: drink.name });
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

  const handleDrinkClick = async (drink: DrinkSuggestion) => {
    setSelectedDrink(drink);
    externalSetSelectedDrink(drink);
    if (!detailedRecipe) {
      await generateDetailedRecipe(drink);
    }
  };

  // Check for updates every minute
  useEffect(() => {
    const checkForUpdates = () => {
      if (shouldRefreshDrinks() && !loading) {
        generateDrinkSuggestions();
      }
    };

    // Initial check
    checkForUpdates();

    // Set up interval
    const interval = setInterval(checkForUpdates, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [shouldRefreshDrinks, loading]);

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
    if (selectedDrink || isGeneratingDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedDrink, isGeneratingDetails]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Move renderDrinkContent inside component
  const renderDrinkContent = (drink: DrinkSuggestion, index: number) => (
    <motion.div 
      key={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      onClick={() => handleDrinkClick(drink)} 
      className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-4 cursor-pointer"
    >
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
        <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
      </div>
      <div className="relative flex flex-col gap-3">
        <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1">{drink.name}</h3>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant="secondary"
            className={cn(
              "flex items-center gap-1 text-xs",
              drink.difficulty === 'Easy' && "bg-green-500/10 text-green-600",
              drink.difficulty === 'Medium' && "bg-yellow-500/10 text-yellow-600",
              drink.difficulty === 'Hard' && "bg-red-500/10 text-red-600"
            )}
          >
            {drink.difficulty === 'Easy'
              ? t('hydrationAI.difficulty.easy')
              : drink.difficulty === 'Medium'
              ? t('hydrationAI.difficulty.medium')
              : drink.difficulty === 'Hard'
              ? t('hydrationAI.difficulty.hard')
              : drink.difficulty}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
            <Timer className="h-3 w-3" />
            {drink.timeToMake}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
            <DollarSign className="h-3 w-3" />
            {drink.budget}
          </Badge>
        </div>
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

  // Example drink suggestions for non-pro users
  const EXAMPLE_DRINKS: DrinkSuggestion[] = [
    {
      name: t('hydrationAI.examples.example1.name'),
      calories: 5,
      type: "Tea",
      difficulty: "Easy",
      timeToMake: `5 ${t('units.min')}`,
      budget: "€",
      quickRecipe: t('hydrationAI.examples.example1.quickRecipe'),
      protein: 0,
      carbs: 1,
      fat: 0
    },
    {
      name: t('hydrationAI.examples.example2.name'),
      calories: 10,
      type: "Infused Water",
      difficulty: "Easy",
      timeToMake: `5 ${t('units.min')}`,
      budget: "€",
      quickRecipe: t('hydrationAI.examples.example2.quickRecipe'),
      protein: 0,
      carbs: 2,
      fat: 0
    }
  ];

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      setSelectedDrink(null);
      resetRecipeState();
    } else {
      y.set(0);
    }
    setIsDragging(false);
  };

  return (
    <div className="relative">
      <NavHide isAIOpen={!!selectedDrink} />

       {/* Title and Refresh Button */}
       <div className="flex items-center justify-between gap-2 mb-2">
         <div className="bg-white shadow-lg border border-black/5 rounded-full px-5 py-3">
           <span className="text-[15px] font-medium text-gray-900">{t('hydrationAI.title')}</span>
         </div>
         <ProFeatures>
           <button
            onClick={() => !loading && generateDrinkSuggestions()}
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
             <div className="bg-white shadow-lg border border-black/5 rounded-xl p-6 text-center">
               <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-3" />
               <p className="text-gray-900 font-medium">{t('hydrationAI.refreshTitle')}</p>
               <p className="text-gray-600 text-sm mt-1">{t('hydrationAI.refreshSubtitle')}</p>
             </div>
           ) : (
            <div className="space-y-2">
              {suggestions.map((drink, index) => renderDrinkContent(drink, index))}
            </div>
          )}
        </ProFeatures>

        <ProFeatures showOnlyForNonPro>
          {/* Non-pro user content */}
          <div className="space-y-2">
            {EXAMPLE_DRINKS.map((drink, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-4 cursor-pointer"
              >

                <div className="relative flex flex-col gap-3">
                  <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1">{drink.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        drink.difficulty === 'Easy' && "bg-green-500/10 text-green-600",
                        drink.difficulty === 'Medium' && "bg-yellow-500/10 text-yellow-600",
                        drink.difficulty === 'Hard' && "bg-red-500/10 text-red-600"
                      )}
                    >
                      {drink.difficulty === 'Easy'
                        ? t('hydrationAI.difficulty.easy')
                        : drink.difficulty === 'Medium'
                        ? t('hydrationAI.difficulty.medium')
                        : drink.difficulty === 'Hard'
                        ? t('hydrationAI.difficulty.hard')
                        : drink.difficulty}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                      <Clock className="h-3 w-3" />
                      {drink.timeToMake}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                      <DollarSign className="h-3 w-3" />
                      {drink.budget}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
            <motion.div 
              onClick={() => setIsProPanelOpen(true)}
              className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-4 cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: EXAMPLE_DRINKS.length * 0.1 }}
            >

              <div className="relative flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <p className="text-gray-900 text-sm font-medium">{t('hydrationAI.subscribeCTA')}</p>
              </div>
            </motion.div>
          </div>
        </ProFeatures>
      </div>

      {/* Recipe Popup (via portal) */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence mode="wait">
        {selectedDrink && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99998]"
              onClick={() => {
                setSelectedDrink(null);
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
                            {t('hydrationAI.percentComplete', { percent: Math.round(generationProgress) })}
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
                            {selectedDrink.name}
                          </h2>
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge className="bg-blue-500/10 text-blue-500 px-3 py-1">
                              {(() => {
                                const rawType = selectedDrink.type || '';
                                const slug = rawType
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '_')
                                  .replace(/^_+|_+$/g, '');
                                return t(`hydrationAI.types.${slug}`, { defaultValue: rawType });
                              })()}
                            </Badge>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {selectedDrink.timeToMake}
                            </div>
                            <Badge className={cn(
                              "px-3 py-1",
                              selectedDrink.difficulty === 'Easy' && "bg-green-500/10 text-green-500",
                              selectedDrink.difficulty === 'Medium' && "bg-yellow-500/10 text-yellow-500",
                              selectedDrink.difficulty === 'Hard' && "bg-red-500/10 text-red-500"
                            )}>
                              {selectedDrink.difficulty === 'Easy'
                                ? t('hydrationAI.difficulty.easy')
                                : selectedDrink.difficulty === 'Medium'
                                  ? t('hydrationAI.difficulty.medium')
                                  : selectedDrink.difficulty === 'Hard'
                                    ? t('hydrationAI.difficulty.hard')
                                    : selectedDrink.difficulty}
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
                            alt={selectedDrink.name}
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
                              <span className="text-sm font-medium text-gray-900">{t('hydrationAI.calories')}</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{selectedDrink.calories}</p>
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
                              <span className="text-sm font-medium text-gray-900">{t('hydrationAI.protein')}</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{selectedDrink.protein}g</p>
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
                              <span className="text-sm font-medium text-gray-900">{t('hydrationAI.carbs')}</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{selectedDrink.carbs}g</p>
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
                              <span className="text-sm font-medium text-gray-900">{t('hydrationAI.fat')}</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{selectedDrink.fat}g</p>
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
                              <h3 className="text-lg font-medium text-gray-900">{t('hydrationAI.ingredients')}</h3>
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
                              <h3 className="text-lg font-medium text-gray-900">{t('hydrationAI.instructions')}</h3>
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
                              <h3 className="text-lg font-medium text-gray-900">{t('hydrationAI.proTips')}</h3>
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
                        { (detailedRecipe.youtubeLink || selectedDrink?.name) && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="relative"
                          >
                            <a
                              href={
                                detailedRecipe.youtubeLink
                                  ? detailedRecipe.youtubeLink
                                  : `https://www.youtube.com/results?search_query=${encodeURIComponent(t('hydrationAI.youtubeSearch', { name: selectedDrink.name }))}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative flex items-center justify-center gap-3 w-full p-4 rounded-xl overflow-hidden bg-gradient-to-br from-red-500/10 to-pink-500/10 hover:from-red-500/20 hover:to-pink-500/20 transition-all"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 group-hover:translate-x-full transition-transform duration-1000" />
                              <Youtube className="h-6 w-6 text-red-500 group-hover:scale-110 transition-transform" />
                              <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition-colors">
                                {t('hydrationAI.watchVideo')}
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
      <style dangerouslySetInnerHTML={{ __html: `
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
        
        /* Add more enhanced styles... */
      `}} />
    </div>
  );
};

export default HydrationAI;
