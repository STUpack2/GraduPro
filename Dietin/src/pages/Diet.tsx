import { useState, useMemo, useEffect, useRef } from "react";
import { useUserStore } from "@/stores/userStore";
import { useNutritionStore } from "@/stores/nutritionStore";
import { AlertCircle, Camera, Loader2, X, Plus, UtensilsCrossed, Utensils, Flame, Dumbbell, Wheat, Droplet, Pencil, ChevronDown, ImageIcon, Sparkles, RefreshCw, Lock, ChevronLeft, CalendarDays, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CalorieEntry
} from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import MealSuggestionsAI from "@/components/MealSuggestionsAI";
import MealAnalysis from "@/components/MealAnalysis";
import { toast } from "sonner";
import ProSubscriptionPanel from "@/components/ProSubscriptionPanel";
import NavHide from "@/components/NavHide";
import ProFeatures from "@/components/ProFeatures";
import { Link, useLocation } from "react-router-dom";
import { format } from "date-fns";
// Removed unused UserProfile import to fix TS error
import { genAI } from "@/lib/gemini";
import { useTranslation } from 'react-i18next';

const SPRING_CONFIG = {
  type: "spring",
  damping: 25,
  stiffness: 200,
};

interface NewFood {
  description: string;
  mealTag: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number;
}

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

interface USDAFood {
  fdcId: string;
  description: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: USDANutrient[];
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  foodCategory?: string;
}

interface USDASearchResult {
  foods: USDAFood[];
  currentPage: number;
  totalPages: number;
}

const defaultNewFood: NewFood = {
  description: "",
  mealTag: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  healthScore: 0
};

const textareaStyles = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  resize: 'none',
  '&::-webkit-scrollbar': {
    display: 'none'
  }
} as const;

// Props interface not used; Diet is self-contained

const Diet = () => {
  const {
    user,
    dailyCalories,
    addCalorieEntry,
    editCalorieEntry,
    removeCalorieEntry,
    getDailyCalories,
    updateUser,
    customTags,
    addCustomTag,
    removeCustomTag,
    checkAndResetDaily,
    checkAndResetQuotas
  } = useUserStore();

  const setExceededNutrient = useNutritionStore((state) => state.setExceededNutrient);

  const [isAddingFood, setIsAddingFood] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<{ id: string; date: string } | null>(null);
  const [isAddingCustomTag, setIsAddingCustomTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectContentRef = useRef<HTMLDivElement>(null);
  const [showSearchBar, setShowSearchBar] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<USDAFood[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<USDAFood | null>(null);
  const [portionSize, setPortionSize] = useState(100);
  const [portionUnit, setPortionUnit] = useState("g");
  const [canFocus, setCanFocus] = useState(false);
  const [isMealAnalysisOpen, setIsMealAnalysisOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalorieEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const location = useLocation();
  const { t } = useTranslation();

  const today = format(selectedDate, "yyyy-MM-dd");
  const [dailyData, setDailyData] = useState(getDailyCalories(today));

  // Open Search panel automatically when navigated here from other pages via Plus -> Meal Analysis -> Search
  useEffect(() => {
    if (location.pathname === '/diet') {
      const flag = localStorage.getItem('shouldOpenSearch');
      if (flag === 'true') {
        localStorage.removeItem('shouldOpenSearch');
        setIsSearchOpen(true);
      }
    }
  }, [location.pathname]);

  // Get the daily calorie data whenever it changes
  useEffect(() => {
    const updatedData = getDailyCalories(today);
    setDailyData(updatedData);
    console.log("Diet page updated dailyData:", updatedData);
  }, [today, getDailyCalories]);

  // Get calorie goal from user profile or use default for non-logged users
  const calorieGoal = user?.calorieGoal || 2000;
  const remainingCalories = calorieGoal - (dailyData?.totalCalories || 0);
  const calorieProgress = ((dailyData?.totalCalories || 0) / (calorieGoal || 1)) * 100;

  // Macro goals from user profile or defaults for non-logged users
  const proteinGoal = user?.proteinGoal || 150; // 30% of calories from protein
  const carbsGoal = user?.carbsGoal || 200; // 40% of calories from carbs
  const fatGoal = user?.fatGoal || 67; // 30% of calories from fat

  // Calculate remaining macros
  const remainingProtein = proteinGoal - (dailyData?.totalProtein || 0);
  const remainingCarbs = carbsGoal - (dailyData?.totalCarbs || 0);
  const remainingFat = fatGoal - (dailyData?.totalFat || 0);

  // Calculate progress percentages
  const proteinProgress = ((dailyData?.totalProtein || 0) / proteinGoal) * 100;
  const carbsProgress = ((dailyData?.totalCarbs || 0) / carbsGoal) * 100;
  const fatProgress = ((dailyData?.totalFat || 0) / fatGoal) * 100;

  // Default meal tags (localized)
  const defaultMealTags = [
    t('diet.tags.meal1'),
    t('diet.tags.meal2'),
    t('diet.tags.meal3'),
    t('diet.tags.meal4'),
    t('diet.tags.meal5'),
    t('categories.snacks'),
    t('categories.breakfast'),
    t('categories.lunch'),
    t('categories.dinner')
  ];
  const allTags = [...defaultMealTags, ...customTags];

  const [newFood, setNewFood] = useState<NewFood>({
    ...defaultNewFood,
    mealTag: defaultMealTags[0]
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Add event listener for refreshDietPage event
  useEffect(() => {
    const handleRefreshDietPage = () => {
      console.log("Diet page received refresh event");
      // Directly recompute from store so new entries appear instantly
      const updatedData = getDailyCalories(today);
      setDailyData(updatedData);
    };

    window.addEventListener('refreshDietPage', handleRefreshDietPage);

    return () => {
      window.removeEventListener('refreshDietPage', handleRefreshDietPage);
    };
  }, [today, getDailyCalories]);

  // React to dailyCalories changes via hook dependencies for instant updates
  const dailyCaloriesState = useUserStore((s) => s.dailyCalories);
  useEffect(() => {
    const updatedData = getDailyCalories(today);
    setDailyData(updatedData);
  }, [today, dailyCaloriesState, getDailyCalories]);

  useEffect(() => {
    // If user has no goals set, calculate and update them
    if (user && (!user.calorieGoal || !user.proteinGoal)) {
      const defaultCalories = user.metabolism || 1652;
      updateUser({
        calorieGoal: defaultCalories,
        proteinGoal: Math.round(defaultCalories * 0.3 / 4),
        carbsGoal: Math.round(defaultCalories * 0.4 / 4),
        fatGoal: Math.round(defaultCalories * 0.3 / 9),
      });
    }
  }, [user]);

  useEffect(() => {
    if (user?.calorieGoal) {
      const calories = user.calorieGoal;

      // Calculate macros based on calorie goal
      const proteinCalories = Math.round(calories * 0.3); // 30% from protein
      const fatCalories = Math.round(calories * 0.25);    // 25% from fat
      const carbsCalories = calories - proteinCalories - fatCalories; // Rest from carbs

      // Convert to grams
      const proteinGrams = Math.round(proteinCalories / 4);
      const fatGrams = Math.round(fatCalories / 9);
      const carbsGrams = Math.round(carbsCalories / 4);

      updateUser({
        proteinGoal: proteinGrams,
        carbsGoal: carbsGrams,
        fatGoal: fatGrams,
      });
    }
  }, [user?.calorieGoal]);

  useEffect(() => {
    checkAndResetDaily();

    // Set up interval to check every minute
    const interval = setInterval(checkAndResetDaily, 60000);
    return () => clearInterval(interval);
  }, [checkAndResetDaily]);

  useEffect(() => {
    checkAndResetQuotas();

    // Check quotas every minute
    const interval = setInterval(checkAndResetQuotas, 60000);
    return () => clearInterval(interval);
  }, [checkAndResetQuotas]);

  // Handle meal log trigger from navigation
  useEffect(() => {
    // Open meal log if navigated with state
    if (location.state?.openMealLog) {
      setIsAddingFood(true);
      // Clear the state to prevent reopening
      window.history.replaceState({}, document.title);
    }

    // Listen for meal log trigger event
    const handleOpenMealLog = () => {
      setIsAddingFood(true);
    };

    window.addEventListener('openMealLog', handleOpenMealLog);

    // Cleanup function to reset state when unmounting or navigating away
    return () => {
      window.removeEventListener('openMealLog', handleOpenMealLog);
      setIsAddingFood(false);
      setNewFood(defaultNewFood);
    };
  }, [location]);

  const handleSaveFood = () => {
    if (!newFood.description) return;

    const entry = {
      description: newFood.description,
      foodName: newFood.description,
      calories: Number(newFood.calories),
      protein: Number(newFood.protein),
      carbs: Number(newFood.carbs),
      fat: Number(newFood.fat),
      healthScore: Number(newFood.healthScore || 50),
      mealTag: newFood.mealTag,
      timestamp: new Date().toISOString()
    };

    if (editingMeal) {
      editCalorieEntry(today, editingMeal.id, entry);
      toast.success(t('diet.toast.mealUpdated', { defaultValue: 'Meal updated' }));
    } else {
      addCalorieEntry(entry);
      toast.success(t('diet.toast.mealAdded', { defaultValue: 'Meal added' }));
    }

    // Reset form and close dialog
    setNewFood(defaultNewFood);
    setIsAddingFood(false);
    setEditingMeal(null);
    setImagePreview(null);
    setSelectedImage(null);
    setIsManualEntry(false);
  };

  const handleAddCustomTag = () => {
    if (customTagInput.trim()) {
      addCustomTag(customTagInput.trim());
      setNewFood(prev => ({ ...prev, mealTag: customTagInput.trim() }));
      setCustomTagInput("");
    }
    setIsAddingCustomTag(false);
  };

  const handleImageCapture = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
          setSelectedImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        setIsCalculating(false);
      };

      input.click();
    } catch (error) {
      console.error('Error capturing image:', error);
      setAnalysisWarning('Failed to capture image. Please try again.');
    }
  };

  const handleDescriptionChange = (value: string) => {
    // Reset nutrition values when user edits description
    setNewFood(prev => ({
      ...prev,
      description: value,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      healthScore: 0
    }));
  };

  // Clear image preview when dialog closes
  useEffect(() => {
    if (!isAddingFood) {
      setImagePreview(null);
      setSelectedImage(null);
    }
  }, [isAddingFood]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isAddingFood) {
      setNewFood(defaultNewFood);
      setIsCalculating(false);
      setAnalysisWarning(null);
      setImagePreview(null);
    }
  }, [isAddingFood]);

  // Update dialog title based on mode
  const dialogTitle = editingMeal ? "Edit Meal" : "Add Meal";
  const dialogAction = editingMeal ? "Save Changes" : "Add to Daily Log";

  // Check for exceeded nutrients
  useEffect(() => {
    if (!user || !dailyData) return;

    const checkNutrients = () => {
      const { totalCalories, totalProtein, totalCarbs, totalFat } = dailyData;
      const { calorieGoal, proteinGoal, carbsGoal, fatGoal } = user;

      if (totalCalories > calorieGoal) {
        setExceededNutrient({
          type: "calories",
          amount: totalCalories,
          goal: calorieGoal
        });
      } else if (totalFat > fatGoal) {
        setExceededNutrient({
          type: "fat",
          amount: totalFat,
          goal: fatGoal
        });
      } else if (totalCarbs > carbsGoal) {
        setExceededNutrient({
          type: "carbs",
          amount: totalCarbs,
          goal: carbsGoal
        });
      } else if (totalProtein > proteinGoal) {
        setExceededNutrient({
          type: "protein",
          amount: totalProtein,
          goal: proteinGoal
        });
      } else {
        setExceededNutrient(null);
      }
    };

    checkNutrients();
  }, [dailyData, user, setExceededNutrient]);

  // Add these USDA functions back for meal logging
  const calculateNutrition = (food: USDAFood, size: number = 100) => {
    const multiplier = size / 100;
    const nutrients = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };

    food.foodNutrients.forEach(nutrient => {
      switch (nutrient.nutrientId) {
        case 1008: // Energy (kcal)
          nutrients.calories = nutrient.value * multiplier;
          break;
        case 1003: // Protein
          nutrients.protein = nutrient.value * multiplier;
          break;
        case 1005: // Carbohydrates
          nutrients.carbs = nutrient.value * multiplier;
          break;
        case 1004: // Total fat
          nutrients.fat = nutrient.value * multiplier;
          break;
      }
    });

    return nutrients;
  };

  // Function to add food to meal log
  const addUSDAFood = (food: USDAFood) => {
    const nutrients = calculateNutrition(food, portionSize);
    const entry = {
      description: food.description,
      foodName: food.description,
      calories: Math.round(nutrients.calories),
      protein: Math.round(nutrients.protein),
      carbs: Math.round(nutrients.carbs),
      fat: Math.round(nutrients.fat),
      mealTag: "Meal 1",
      timestamp: new Date().toISOString(),
      isUSDA: true,
      usdaId: food.fdcId,
      portionSize,
      portionUnit: 'g',
      healthScore: 50
    };

    addCalorieEntry(entry);
    // Refresh Diet state immediately so the new entry appears without navigating away
    const updatedData = getDailyCalories(today);
    setDailyData(updatedData);

    setIsSearchOpen(false);
    setSelectedFood(null);
    setSearchQuery('');
  };

  // Function to search USDA database
  const searchUSDA = async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=oba8PbxYBidljYmBQuorEBjn9n9XEyaP4FJd7qUo&query=${encodeURIComponent(query)}&pageSize=25`);
      const data: USDASearchResult = await response.json();
      setSearchResults(data.foods);
    } catch (error) {
      console.error('Error searching USDA database:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchUSDA(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add this effect to handle input focus timing
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        setCanFocus(true);
      }, 800); // Wait for popup animation
      return () => {
        clearTimeout(timer);
        setCanFocus(false);
      };
    }
  }, [isSearchOpen]);

  // Add cleanup for search state
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchQuery('');
      setSelectedFood(null);
    }
  }, [isSearchOpen]);

  return (
    <div className="h-full">
      <NavHide isAIOpen={isAddingFood || isSearchOpen} />
      <div className="h-full overflow-y-auto -webkit-overflow-scrolling-touch pb-4">
        <div className="container mx-auto space-y-6 p-6 pb-24">
          <div className="flex flex-col gap-3">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-[1.75rem] tracking-tight text-black font-sf-display font-sf-bold"
            >
              {t('diet.title')}
            </motion.h1>

            {user && (
              <div className="flex justify-center w-full -mt-1">
                <div className="bg-gray-100 rounded-full p-1 flex items-center shadow-md border border-gray-200/50">
                  <Link
                    to="/diet"
                    className="px-5 py-2 rounded-full bg-white shadow-sm flex items-center gap-2.5 transition-all duration-200 border border-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">{t('nav.diet')}</span>
                    <Utensils className="w-4 h-4 text-primary" />
                  </Link>
                  <Link
                    to="/burn"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('nav.burn')}</span>
                    <Flame className="w-4 h-4 text-gray-600" />
                  </Link>
                  <Link
                    to="/hydration"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('nav.hydration')}</span>
                    <Droplet className="w-4 h-4 text-gray-600" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Add Modern Search Bar */}
          <AnimatePresence mode="wait">
            {showSearchBar && !isSearchOpen && (
              <motion.div
                className="w-full"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: {
                    duration: 0.6,
                    ease: [0.23, 1, 0.32, 1]
                  }
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  y: 20,
                  transition: {
                    duration: 0.6,
                    ease: [0.32, 0, 0.67, 0]
                  }
                }}
              >
                <div className="relative w-full max-w-md mx-auto">
                  <motion.div
                    className="relative flex items-center group p-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: {
                        duration: 0.4,
                        delay: 0.2
                      }
                    }}
                    exit={{
                      opacity: 0,
                      transition: {
                        duration: 0.4
                      }
                    }}
                    onClick={() => setIsSearchOpen(true)}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-white via-purple-50 to-purple-200 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)] opacity-100 group-hover:opacity-100 transition-all duration-300"
                      // Smooth subtle flicker of the glow that fully disappears at the trough
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('search.search_placeholder')}
                      className="relative w-full h-14 pl-14 pr-4 rounded-full bg-white text-gray-900 placeholder-gray-500 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all duration-300 font-medium"
                      readOnly
                      inputMode="none"
                      onFocus={(e) => {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }}
                    // Rely on wrapper onClick to open search. Avoid preventDefault on passive listeners.
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <svg
                        className="w-6 h-6 text-gray-500 group-hover:text-gray-700 transition-colors duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between gap-2 mb-1">
            <Button
              className="w-full bg-white hover:bg-gray-50/95 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 rounded-full px-5 py-3 flex items-center justify-center gap-2 transition-all duration-300"
              onClick={() => setIsMealAnalysisOpen(true)}
            >
              <Plus className="h-4 w-4 text-gray-900" />
              <span className="text-sm font-medium text-gray-900">{t('diet.actions.addFood')}</span>
            </Button>
            <Dialog open={isAddingFood} onOpenChange={setIsAddingFood}>
              <AnimatePresence>
                {isAddingFood && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="fixed top-[-100vh] inset-x-0 bottom-0 bg-black/50 backdrop-blur-sm z-[99999] h-[400vh]"
                      onClick={() => setIsAddingFood(false)}
                    />
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 200
                      }}
                      className="fixed bottom-0 inset-x-0 z-[99999]"
                    >
                      <div className="bg-[#1c1c1e] rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] h-[85vh] relative flex flex-col">
                        <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                          <div className="w-10 h-1 bg-white/20 rounded-full" />
                        </div>

                        <div className="flex items-center justify-between px-6 pb-4 border-b border-white/10 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <Utensils className="h-5 w-5 text-primary" />
                            <h2 className="text-[17px] font-semibold text-white">{dialogTitle}</h2>
                          </div>
                          <button
                            onClick={() => setIsAddingFood(false)}
                            className="p-1 rounded-full hover:bg-white/10 transition-colors"
                          >
                            <X className="h-5 w-5 text-white/80" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-6 pb-32">
                          <div className="space-y-2">
                            <Label>{t('diet.labels.mealTag')}</Label>
                            <Select
                              value={newFood.mealTag}
                              onValueChange={(value) => setNewFood(prev => ({ ...prev, mealTag: value }))}
                            >
                              <SelectTrigger className="bg-background/5 border-white/10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent ref={selectContentRef}>
                                {allTags.map((tag) => (
                                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <AnimatePresence mode="wait">
                            {imagePreview && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="relative rounded-lg overflow-hidden h-24"
                              >
                                <img
                                  src={imagePreview}
                                  alt={t('diet.alt.foodPreview')}
                                  className="w-full h-full object-cover"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label>{t('diet.labels.mealDescription')}</Label>
                              <div className="relative">
                                <Textarea
                                  placeholder={t('diet.placeholders.mealDescription')}
                                  className="h-16 bg-white/5 border-white/10 focus:border-white/20 resize-none"
                                  style={textareaStyles}
                                  value={newFood.description}
                                  onChange={(e) => handleDescriptionChange(e.target.value)}
                                />
                              </div>
                            </div>

                            {isManualEntry && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4"
                              >
                                <div className="space-y-1.5">
                                  <Label>{t('diet.labels.calories')}</Label>
                                  <Input
                                    type="number"
                                    placeholder={t('diet.placeholders.calories')}
                                    className="bg-white/5 border-white/10 focus:border-white/20"
                                    value={newFood.calories || ''}
                                    onChange={(e) => setNewFood(prev => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
                                  />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1.5">
                                    <Label>{t('diet.labels.proteinGrams')}</Label>
                                    <Input
                                      type="number"
                                      placeholder={t('diet.placeholders.protein')}
                                      className="bg-white/5 border-white/10 focus:border-white/20"
                                      value={newFood.protein || ''}
                                      onChange={(e) => setNewFood(prev => ({ ...prev, protein: parseInt(e.target.value) || 0 }))}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>{t('diet.labels.carbsGrams')}</Label>
                                    <Input
                                      type="number"
                                      placeholder={t('diet.placeholders.carbs')}
                                      className="bg-white/5 border-white/10 focus:border-white/20"
                                      value={newFood.carbs || ''}
                                      onChange={(e) => setNewFood(prev => ({ ...prev, carbs: parseInt(e.target.value) || 0 }))}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label>{t('diet.labels.fatGrams')}</Label>
                                    <Input
                                      type="number"
                                      placeholder={t('diet.placeholders.fat')}
                                      className="bg-white/5 border-white/10 focus:border-white/20"
                                      value={newFood.fat || ''}
                                      onChange={(e) => setNewFood(prev => ({ ...prev, fat: parseInt(e.target.value) || 0 }))}
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>

                          <div className="mt-auto">
                            <div className="space-y-4">
                              <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4 space-y-2 bg-[#1c1c1e]">
                                <AnimatePresence mode="wait">
                                  {!isManualEntry ? (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="space-y-2"
                                    >
                                      <div className="flex gap-2">
                                        <motion.div
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -10 }}
                                          transition={{ duration: 0.3, delay: 0.1 }}
                                          className="w-1/2"
                                        >
                                          <Button
                                            className="w-full gap-2 bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.08] transition-all duration-300 rounded-xl h-[48px]"
                                            variant="outline"
                                            onClick={handleImageCapture}
                                          >
                                            <Camera className="h-4 w-4" />
                                            {t('diet.actions.takePhotoOfMeal')}
                                          </Button>
                                        </motion.div>

                                        <motion.div
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -10 }}
                                          transition={{ duration: 0.3, delay: 0.2 }}
                                          className="w-1/2"
                                        >
                                          <Button
                                            className="w-full gap-2 bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.08] transition-all duration-300 rounded-xl h-[48px]"
                                            variant="outline"
                                            onClick={() => setIsManualEntry(true)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                            Enter Values Manually
                                          </Button>
                                        </motion.div>
                                      </div>

                                      <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3, delay: 0.3 }}
                                      >
                                        <Button
                                          className="w-full gap-2 bg-[#4776E6] hover:bg-[#4776E6]/90 transition-all duration-300 rounded-xl h-[48px]"
                                          onClick={handleSaveFood}
                                          disabled={!newFood.description || !newFood.calories}
                                        >
                                          <Plus className="h-4 w-4" />
                                          Add to Daily Log
                                        </Button>
                                      </motion.div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="space-y-2"
                                    >
                                      <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3, delay: 0.1 }}
                                      >
                                        <Button
                                          className="w-full gap-2 bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.08] transition-all duration-300 rounded-xl h-[48px]"
                                          variant="outline"
                                          onClick={() => {
                                            setIsManualEntry(false);
                                            setNewFood(defaultNewFood);
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </motion.div>

                                      <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3, delay: 0.2 }}
                                      >
                                        <Button
                                          className="w-full gap-2 bg-[#4776E6] hover:bg-[#4776E6]/90 transition-all duration-300 rounded-xl h-[48px]"
                                          onClick={() => {
                                            setNewFood(prev => ({ ...prev, healthScore: 50 }));
                                            handleSaveFood();
                                            setIsManualEntry(false);
                                          }}
                                          disabled={!newFood.description || !newFood.calories}
                                        >
                                          Save Entry
                                        </Button>
                                      </motion.div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </Dialog>
          </div>

          <div className="space-y-2 mt-1">
            {(!dailyData?.entries || dailyData.entries.length === 0) ? (
              <div className="text-center py-8 bg-white shadow-lg border border-black/5 rounded-3xl">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-900 font-medium">{t('diet.empty.noFoodsToday')}</p>
                <p className="text-sm text-gray-600">{t('diet.empty.addMealCta')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dailyData.entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="group relative z-10 bg-white rounded-3xl transition-all duration-200 shadow-md hover:shadow-lg border border-gray-100 hover:border-purple-100/70 hover:shadow-purple-100/30 w-full max-w-2xl mx-auto"
                  >
                    <div className="relative p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{entry.mealTag}</span>
                          <span className="text-gray-400 whitespace-nowrap">·</span>
                          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{entry.calories} {t('diet.units.cal')}</span>
                          <span className="text-gray-400 whitespace-nowrap">·</span>
                          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{entry.healthScore}/100</span>
                        </div>
                        <p className="text-[15px] font-medium text-gray-900 line-clamp-1 pr-12 font-sf-display">
                          {entry.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs font-medium text-red-600/90 whitespace-nowrap">{entry.protein}{t('diet.units.gramShort')} <span className="text-gray-500">{t('diet.protein')}</span></span>
                          <span className="text-xs font-medium text-green-600/90 whitespace-nowrap">{entry.carbs}{t('diet.units.gramShort')} <span className="text-gray-500">{t('diet.carbs')}</span></span>
                          <span className="text-xs font-medium text-yellow-600/90 whitespace-nowrap">{entry.fat}{t('diet.units.gramShort')} <span className="text-gray-500">{t('diet.fat')}</span></span>
                        </div>
                      </div>

                      <div className="relative flex items-center gap-3">
                        {/* Macro Distribution Circle */}
                        <div className="relative w-8 h-8">
                          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                            {(() => {
                              const total = entry.protein * 4 + entry.carbs * 4 + entry.fat * 9;
                              const proteinPerc = (entry.protein * 4 / total) * 100;
                              const carbsPerc = (entry.carbs * 4 / total) * 100;
                              const fatPerc = (entry.fat * 9 / total) * 100;
                              return (
                                <>
                                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgb(220, 38, 38)" strokeWidth="2.5" strokeDasharray={`${proteinPerc} ${100 - proteinPerc}`} strokeDashoffset={0} className="transition-all duration-300" />
                                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgb(22, 163, 74)" strokeWidth="2.5" strokeDasharray={`${carbsPerc} ${100 - carbsPerc}`} strokeDashoffset={-proteinPerc} className="transition-all duration-300" />
                                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgb(202, 138, 4)" strokeWidth="2.5" strokeDasharray={`${fatPerc} ${100 - fatPerc}`} strokeDashoffset={-(proteinPerc + carbsPerc)} className="transition-all duration-300" />
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="relative flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            onClick={() => {
                              setEditingEntry(entry);
                              setIsMealAnalysisOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            onClick={() => removeCalorieEntry(today, entry.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* AI Meal Suggestions Component */}
          <div className="mt-6">
            <MealSuggestionsAI
              remainingCalories={remainingCalories}
              remainingProtein={remainingProtein}
              remainingCarbs={remainingCarbs}
              remainingFat={remainingFat}
              currentTime={new Date()}
              budget="moderate"
            />
          </div>
        </div>
      </div>
      <ProSubscriptionPanel isOpen={isProPanelOpen} onClose={() => setIsProPanelOpen(false)} />
      <MealAnalysis
        isOpen={isMealAnalysisOpen}
        onClose={() => {
          setIsMealAnalysisOpen(false);
          setEditingEntry(null);
          // Refresh data when closing the analysis panel
          const updatedData = getDailyCalories(today);
          setDailyData(updatedData);
          console.log("Refreshed data after meal analysis closed:", updatedData);
        }}
        setIsSearchOpen={setIsSearchOpen}
        editEntry={editingEntry}
      />

      {/* Search Popup */}
      <AnimatePresence>
        {isSearchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] h-[400vh] top-[-100vh]"
              onClick={() => {
                setSelectedFood(null);
                setIsSearchOpen(false);
              }}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 8 }}
              exit={{ y: "100%" }}
              transition={SPRING_CONFIG}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0}
              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
              dragMomentum={false}
              onDrag={(e, { offset }) => {
                if (offset.y < 0) {
                  (e.target as HTMLElement).style.transform = `translateY(8px)`;
                }
              }}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 50 || velocity.y > 50) {
                  setIsSearchOpen(false);
                  setSelectedFood(null);
                } else {
                  (e.target as HTMLElement).style.transform = `translateY(8px)`;
                }
              }}
              style={{ touchAction: 'none' }}
              className="fixed bottom-0 inset-x-0 z-[99999] touch-none select-none overscroll-none"
            >
              <div className="bg-white rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] h-[85vh] relative flex flex-col border border-gray-200">
                {/* Handle */}
                <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {selectedFood ? (
                  <>
                    {/* Selected Food Header */}
                    <div className="flex items-center justify-between px-6 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedFood(null)}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <ChevronLeft className="h-5 w-5 text-gray-700" />
                        </button>
                        <h2 className="text-[17px] font-semibold text-gray-900">Add to Meal Log</h2>
                      </div>
                    </div>

                    {/* Selected Food Content */}
                    <div className="flex-1 overflow-y-auto overscroll-none p-6 space-y-6">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl p-4 space-y-4 border border-gray-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Utensils className="w-8 h-8 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-gray-900">{selectedFood.description}</h3>
                            {selectedFood.brandOwner && (
                              <p className="text-sm text-gray-600">{selectedFood.brandOwner}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(calculateNutrition(selectedFood, portionSize)).map(([nutrient, value]) => (
                            <div key={nutrient} className="bg-gray-50 rounded-lg p-3">
                              <div className="text-sm text-gray-600 capitalize">{t(`diet.${nutrient}`)}</div>
                              <div className="text-lg font-medium text-gray-900">
                                {Math.round(value)}
                                {nutrient === 'calories' ? ' cal' : 'g'}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3">
                          <Label className="text-gray-900">Portion Size (grams)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={portionSize}
                              onChange={(e) => setPortionSize(Number(e.target.value))}
                              className="bg-white border-gray-300 focus:border-purple-400"
                              min={0}
                              step={1}
                            />
                            <span className="text-gray-600 text-sm">g</span>
                          </div>
                        </div>

                        <Button
                          className="w-full h-12 text-base font-medium bg-black text-white hover:bg-gray-800 border-0"
                          onClick={() => addUSDAFood(selectedFood)}
                        >
                          {t('search.add_to_meal_log')}
                        </Button>
                      </motion.div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Search Header */}
                    <div className="flex-shrink-0 p-4 space-y-4">
                      <div className="relative flex items-center group">
                        <div className="absolute inset-0 bg-gradient-to-r from-white via-purple-50 to-purple-200 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] opacity-95 group-hover:opacity-100 transition-all duration-300" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t('search.search_placeholder')}
                          className="relative w-full h-14 pl-14 pr-4 rounded-full bg-white text-black placeholder-gray-500 ring-1 ring-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-300 font-medium"
                          autoFocus={canFocus}
                          readOnly={!canFocus}
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <svg
                            className="w-6 h-6 text-gray-700 group-hover:text-gray-900 transition-colors duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Quick Filters */}
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                          t('categories.low_calorie'),
                          t('categories.high_protein'),
                          t('categories.vegetarian'),
                          t('categories.breakfast'),
                          t('categories.lunch'),
                          t('categories.dinner'),
                          t('categories.snacks')
                        ].map((filter) => (
                          <motion.button
                            key={filter}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-4 py-2 rounded-full bg-white hover:bg-purple-50 border border-gray-200 text-sm font-medium text-gray-700 whitespace-nowrap transition-all duration-200"
                            onClick={() => setSearchQuery(filter)}
                          >
                            {filter}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Search Results Area */}
                    <div className="flex-1 overflow-y-auto overscroll-none touch-pan-y scrollbar-hide">
                      <div className="p-4 space-y-4">
                        {isSearching ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-8 gap-3"
                          >
                            <Loader2 className="h-6 w-6 animate-spin text-gray-700" />
                            <span className="text-sm text-gray-600">Searching for the best matches...</span>
                          </motion.div>
                        ) : searchResults.length > 0 ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-3"
                          >
                            {searchResults.map((food, index) => (
                              <motion.div
                                key={food.fdcId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  transition: {
                                    delay: index * 0.05,
                                    type: "spring",
                                    stiffness: 100,
                                    damping: 15
                                  }
                                }}
                                whileHover={{ scale: 0.98 }}
                                className="group relative bg-white rounded-xl p-4 border border-gray-200 hover:bg-purple-50 transition-all duration-300 cursor-pointer shadow-lg"
                                onClick={() => setSelectedFood(food)}
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-medium text-gray-900 line-clamp-2 mb-2">{food.description}</h3>
                                    {food.brandOwner && (
                                      <p className="text-sm text-gray-600 mb-2">{food.brandOwner}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{Math.round(calculateNutrition(food).calories)} {t('diet.units.cal')}</span>
                                      <span className="text-sm text-gray-700 whitespace-nowrap">{Math.round(calculateNutrition(food).protein)}{t('diet.units.gramShort')} {t('diet.protein')}</span>
                                      <span className="text-sm text-gray-700 whitespace-nowrap">{Math.round(calculateNutrition(food).carbs)}{t('diet.units.gramShort')} {t('diet.carbs')}</span>
                                      <span className="text-sm text-gray-700 whitespace-nowrap">{Math.round(calculateNutrition(food).fat)}{t('diet.units.gramShort')} {t('diet.fat')}</span>
                                    </div>
                                  </div>
                                  <div className="relative w-8 h-8">
                                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                      {(() => {
                                        const nutrients = calculateNutrition(food);
                                        const total = nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9;
                                        const proteinPerc = (nutrients.protein * 4 / total) * 100;
                                        const carbsPerc = (nutrients.carbs * 4 / total) * 100;
                                        const fatPerc = (nutrients.fat * 9 / total) * 100;

                                        return (
                                          <>
                                            <circle
                                              cx="18"
                                              cy="18"
                                              r="15.915"
                                              fill="none"
                                              stroke="rgb(220, 38, 38)"
                                              strokeWidth="2.5"
                                              strokeDasharray={`${proteinPerc} ${100 - proteinPerc}`}
                                              strokeDashoffset={0}
                                              className="transition-all duration-300"
                                            />
                                            <circle
                                              cx="18"
                                              cy="18"
                                              r="15.915"
                                              fill="none"
                                              stroke="rgb(22, 163, 74)"
                                              strokeWidth="2.5"
                                              strokeDasharray={`${carbsPerc} ${100 - carbsPerc}`}
                                              strokeDashoffset={-proteinPerc}
                                              className="transition-all duration-300"
                                            />
                                            <circle
                                              cx="18"
                                              cy="18"
                                              r="15.915"
                                              fill="none"
                                              stroke="rgb(202, 138, 4)"
                                              strokeWidth="2.5"
                                              strokeDasharray={`${fatPerc} ${100 - fatPerc}`}
                                              strokeDashoffset={-(proteinPerc + carbsPerc)}
                                              className="transition-all duration-300"
                                            />
                                          </>
                                        );
                                      })()}
                                    </svg>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </motion.div>
                        ) : searchQuery ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-8 space-y-3"
                          >
                            <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-600" />
                            <p className="text-gray-600">{t('search.no_results', { query: searchQuery })}</p>
                            <p className="text-sm text-gray-500">{t('search.try_adjusting')}</p>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                          >
                            {/* Popular Categories */}
                            <div className="space-y-3">
                              <h3 className="text-sm font-medium text-gray-600">{t('search.popular_categories')}</h3>
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { name: t('categories.breakfast'), icon: "🍳" },
                                  { name: t('categories.lunch'), icon: "🥗" },
                                  { name: t('categories.dinner'), icon: "🍽️" },
                                  { name: t('categories.snacks'), icon: "🍿" }
                                ].map((category, index) => (
                                  <motion.button
                                    key={category.name}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{
                                      opacity: 1,
                                      scale: 1,
                                      transition: {
                                        delay: index * 0.1,
                                        type: "spring",
                                        stiffness: 100,
                                        damping: 15
                                      }
                                    }}
                                    whileHover={{ scale: 0.95 }}
                                    className="p-4 rounded-xl bg-white border border-gray-200 hover:bg-purple-50 transition-all duration-300 group"
                                    onClick={() => setSearchQuery(category.name)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl">{category.icon}</span>
                                      <span className="text-gray-900 font-medium group-hover:text-gray-900 transition-colors">{category.name}</span>
                                    </div>
                                  </motion.button>
                                ))}
                              </div>
                            </div>

                            {/* Quick Suggestions */}
                            <div className="space-y-3">
                              <h3 className="text-sm font-medium text-gray-600">{t('search.quick_suggestions')}</h3>
                              <div className="space-y-2">
                                {[
                                  t('home.quick_suggestions.chicken_breast'),
                                  t('home.quick_suggestions.greek_yogurt'),
                                  t('home.quick_suggestions.oatmeal'),
                                  t('home.quick_suggestions.salmon'),
                                  t('home.quick_suggestions.quinoa_bowl'),
                                  t('home.quick_suggestions.protein_shake')
                                ].map((suggestion, index) => (
                                  <motion.button
                                    key={suggestion}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{
                                      opacity: 1,
                                      x: 0,
                                      transition: {
                                        delay: index * 0.05,
                                        type: "spring",
                                        stiffness: 100,
                                        damping: 15
                                      }
                                    }}
                                    className="w-full p-3 text-left rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-purple-50 transition-all duration-200"
                                    onClick={() => setSearchQuery(suggestion)}
                                  >
                                    {suggestion}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Diet;