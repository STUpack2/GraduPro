import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import NavHide from "./NavHide";
import { cn } from "@/lib/utils";
import { Camera, Pencil, Search, Sparkles, X, Plus, Tag, ChevronLeft, Loader2, BarChart3, Utensils, Flame, Lock } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { genAI, analyzeNutrition } from "@/lib/gemini";
import { db } from "@/lib/firebase";
import { doc, getDoc, increment } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import ProSubscriptionPanel from "./ProSubscriptionPanel";
import MealAnalysisAnimate from "./MealAnalysisAnimate";
import ImproveAI from "./ImproveAI";
import { useTranslation } from "react-i18next";

// Modern font styles
const fontStyles = {
  heading: "font-sans font-bold tracking-tight",
  subheading: "font-sans font-medium tracking-tight",
  body: "font-sans text-sm tracking-wide",
  caption: "font-sans text-xs tracking-wide",
  button: "font-sans font-medium tracking-wide"
};

interface AnalysisResult {
  isFood: boolean;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cholesterol: number;
  magnesium: number;
  sugar: number;
  fiber?: number;
  sodium?: number;
  potassium?: number;
  vitaminA?: number;
  vitaminC?: number;
  calcium?: number;
  iron?: number;
  score: number;
  suggestions: string[];
  ingredients: string[];
  error?: string;
}

interface MealAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  setIsSearchOpen: (open: boolean) => void;
  editEntry?: {
    description: string;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealTag: string;
    timestamp: string;
    healthScore: number;
  };
}

const MealAnalysis = ({ isOpen, onClose, setIsSearchOpen, editEntry }: MealAnalysisProps) => {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const { t, i18n } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(!!editEntry);
  const [isAIDescription, setIsAIDescription] = useState(false);
  const [isSnapPhoto, setIsSnapPhoto] = useState(false);
  const [selectedTag, setSelectedTag] = useState(editEntry?.mealTag || "");
  const [customTag, setCustomTag] = useState("");
  const [mealTitle, setMealTitle] = useState(editEntry?.foodName || "");
  const [calories, setCalories] = useState(editEntry?.calories?.toString() || "");
  const [protein, setProtein] = useState(editEntry?.protein?.toString() || "");
  const [carbs, setCarbs] = useState(editEntry?.carbs?.toString() || "");
  const [fat, setFat] = useState(editEntry?.fat?.toString() || "");
  const [savedTags, setSavedTags] = useState<string[]>(() => {
    const saved = localStorage.getItem('customMealTags');
    return saved ? JSON.parse(saved) : [];
  });
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showInput, setShowInput] = useState(true);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoAnalysisResult, setPhotoAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isPhotoAnalyzing, setIsPhotoAnalyzing] = useState(false);
  const [showPhotoInput, setShowPhotoInput] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [newFood, setNewFood] = useState({
    description: '',
    mealTag: t('mealAnalysis.tags.meal1'),
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    healthScore: 50
  });
  const [recommendations, setRecommendations] = useState({
    add: [],
    remove: [],
    explanation: '',
    adjustedScore: 0,
    adjustedNutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    }
  });
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  const { addCalorieEntry, user, dailyMealAnalysis, incrementMealAnalysis } = useUserStore();

  const tags = [
    t('mealAnalysis.tags.breakfast'),
    t('mealAnalysis.tags.lunch'),
    t('mealAnalysis.tags.dinner'),
    t('mealAnalysis.tags.snack'),
    t('mealAnalysis.tags.meal1'),
    t('mealAnalysis.tags.meal2'),
    t('mealAnalysis.tags.meal3')
  ];

  // Prevent scrolling on the main page when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.touchAction = 'none';
      // Hide nav when opening
      document.dispatchEvent(new CustomEvent('setNavHide', { detail: { isHidden: true } }));
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  // Update form when editEntry changes
  useEffect(() => {
    if (editEntry) {
      setIsManualEntry(true);
      setSelectedTag(editEntry.mealTag);
      setMealTitle(editEntry.foodName);
      setCalories(editEntry.calories.toString());
      setProtein(editEntry.protein.toString());
      setCarbs(editEntry.carbs.toString());
      setFat(editEntry.fat.toString());
    }
  }, [editEntry]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    } else {
      y.set(0);
    }
    setIsDragging(false);
  };

  const handleSearchClick = () => {
    onClose(); // Close MealAnalysis popup
    // Keep nav hidden during transition
    setTimeout(() => {
      setIsSearchOpen(true); // Open search popup
    }, 300);
  };

  let isTransitioningToSearch = false;

  const handleClose = () => {
    if (isTransitioningToSearch) return;
    onClose();
    // Always reset form when closing
    resetForm();
    // Always show nav when closing
    document.dispatchEvent(new CustomEvent('setNavHide', { detail: { isHidden: false } }));
  };

  // Set flag before transitioning to search
  useEffect(() => {
    const handleBeforeSearch = () => {
      isTransitioningToSearch = true;
      setTimeout(() => {
        isTransitioningToSearch = false;
      }, 500);
    };

    return () => {
      if (!isTransitioningToSearch) {
        document.dispatchEvent(new CustomEvent('setNavHide', { detail: { isHidden: false } }));
      }
    };
  }, []);

  const handleManualEntryClick = () => {
    setIsManualEntry(true);
  };

  const handleAIDescriptionClick = () => {
    setIsAIDescription(true);
  };

  const handleSnapPhotoClick = () => {
    setIsSnapPhoto(true);
  };

  const handleBackClick = () => {
    if (isAIDescription) {
      if (analysisResult) {
        setAnalysisResult(null);
        setShowInput(true);
      } else {
        setIsAIDescription(false);
        setDescription("");
      }
    } else if (isSnapPhoto) {
      if (photoAnalysisResult) {
        setPhotoAnalysisResult(null);
        setShowPhotoInput(true);
      } else {
        setIsSnapPhoto(false);
      }
      setSelectedFile(null);
      setIsPhotoAnalyzing(false);
    } else {
      setIsManualEntry(false);
    }
    // Reset form if going back to options
    if (!isAIDescription || (isAIDescription && !analysisResult)) {
      resetForm();
    }
  };

  const handleSaveCustomTag = () => {
    if (!customTag) return;
    const newTags = [...new Set([...savedTags, customTag])];
    setSavedTags(newTags);
    localStorage.setItem('customMealTags', JSON.stringify(newTags));
    setSelectedTag(customTag);
    setCustomTag("");
  };

  // Add a function to save the analyzed meal
  const handleSaveAnalyzedMeal = () => {
    if (!analysisResult || !analysisResult.isFood) return;

    const entry = {
      description: analysisResult.title,
      foodName: analysisResult.title,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      carbs: analysisResult.carbs,
      fat: analysisResult.fat,
      mealTag: selectedTag || t('mealAnalysis.tags.meal1'),
      timestamp: new Date().toISOString(),
      healthScore: analysisResult.score,
      cholesterol: analysisResult.cholesterol,
      magnesium: analysisResult.magnesium,
      sugar: analysisResult.sugar,
      fiber: analysisResult.fiber,
      sodium: analysisResult.sodium,
      potassium: analysisResult.potassium,
      vitaminA: analysisResult.vitaminA,
      vitaminC: analysisResult.vitaminC,
      calcium: analysisResult.calcium,
      iron: analysisResult.iron,
      ingredients: analysisResult.ingredients,
      year: new Date().getFullYear()
    };

    console.log("Saving analyzed meal:", entry);
    addCalorieEntry(entry);

    // Show user feedback
    const event = new CustomEvent('showErrorToast', {
      detail: { message: t('mealAnalysis.saveSuccess') }
    });
    window.dispatchEvent(event);

    onClose();
    resetForm();
    document.dispatchEvent(new CustomEvent('setNavHide', { detail: { isHidden: false } }));

    // Add a small delay and then fire an event to tell Diet component to refresh
    setTimeout(() => {
      const refreshEvent = new CustomEvent('refreshDietPage');
      window.dispatchEvent(refreshEvent);
    }, 100);
  };

  const handleSavePhotoAnalyzedMeal = () => {
    if (!photoAnalysisResult || !photoAnalysisResult.isFood) return;

    // Use the same save logic as AI description
    const entry = {
      description: photoAnalysisResult.title,
      foodName: photoAnalysisResult.title,
      calories: photoAnalysisResult.calories,
      protein: photoAnalysisResult.protein,
      carbs: photoAnalysisResult.carbs,
      fat: photoAnalysisResult.fat,
      mealTag: selectedTag || t('mealAnalysis.tags.meal1'),
      timestamp: new Date().toISOString(),
      healthScore: photoAnalysisResult.score,
      cholesterol: photoAnalysisResult.cholesterol,
      magnesium: photoAnalysisResult.magnesium,
      sugar: photoAnalysisResult.sugar,
      fiber: photoAnalysisResult.fiber,
      sodium: photoAnalysisResult.sodium,
      potassium: photoAnalysisResult.potassium,
      vitaminA: photoAnalysisResult.vitaminA,
      vitaminC: photoAnalysisResult.vitaminC,
      calcium: photoAnalysisResult.calcium,
      iron: photoAnalysisResult.iron,
      ingredients: photoAnalysisResult.ingredients,
      year: new Date().getFullYear()
    };

    console.log("Saving photo analyzed meal:", entry);
    addCalorieEntry(entry);

    // Show user feedback
    const event = new CustomEvent('showErrorToast', {
      detail: { message: t('mealAnalysis.saveSuccess') }
    });
    window.dispatchEvent(event);

    onClose();
    resetForm();
    document.dispatchEvent(new CustomEvent('setNavHide', { detail: { isHidden: false } }));

    // Add a small delay and then fire an event to tell Diet component to refresh
    setTimeout(() => {
      const refreshEvent = new CustomEvent('refreshDietPage');
      window.dispatchEvent(refreshEvent);
    }, 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowPhotoInput(false); // Hide input immediately
      setIsPhotoAnalyzing(true); // Show loader immediately
      analyzeWithPhoto(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const analyzeWithPhoto = async (file: File) => {
    try {
      setIsPhotoAnalyzing(true);
      setShowPhotoInput(false);

      // Get real-time pro status from Firestore
      const userDoc = await getDoc(doc(db, "users", auth.currentUser?.uid));
      const isPro = userDoc.exists() ? userDoc.data().isPro || false : false;

      console.log('Checking meal analysis quota:', {
        isPro,
        dailyMealAnalysis,
        limit: 1
      });

      // Check if user is not pro and has reached quota
      if (!isPro && dailyMealAnalysis >= 1) {
        const event = new CustomEvent('showErrorToast', {
          detail: { message: 'Daily image analysis limit reached (1/1). Please subscribe to DietinPro for unlimited analysis or wait 24 hours.' }
        });
        window.dispatchEvent(event);
        throw new Error('Quota reached');
      }

      // Increment quota counter before analysis for non-pro users
      if (!isPro) {
        console.log('Incrementing meal analysis quota for free user');
        incrementMealAnalysis();
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Image = reader.result?.toString().split(',')[1];

          // Enhanced prompt for better food recognition
          const promptLanguage = i18n.language?.startsWith('ar') ? 'Arabic' : 'English';
          const prompt = `Analyze this food image and provide detailed nutritional information. If you can't clearly identify the food or if the image is not of food, please respond with {"isFood": false, "error": "reason"}.

          If you can identify the food, respond with nutritional information in this exact JSON format:
          {
            "isFood": true,
            "title": "Detailed food name",
            "calories": estimated_calories,
            "protein": estimated_protein_in_grams,
            "carbs": estimated_carbs_in_grams,
            "fat": estimated_fat_in_grams,
            "cholesterol": estimated_cholesterol_in_mg,
            "magnesium": estimated_magnesium_in_mg,
            "sugar": estimated_sugar_in_grams,
            "fiber": estimated_fiber_in_grams,
            "sodium": estimated_sodium_in_mg,
            "potassium": estimated_potassium_in_mg,
            "vitaminA": estimated_vitamin_a_daily_value_percentage,
            "vitaminC": estimated_vitamin_c_daily_value_percentage,
            "calcium": estimated_calcium_daily_value_percentage,
            "iron": estimated_iron_daily_value_percentage,
            "score": health_score_0_to_100,
            "suggestions": ["improvement suggestions"],
            "ingredients": ["detected ingredients"]
          }
          
          Be as accurate as possible with the nutritional values. If you're uncertain about any values, provide conservative estimates.
          IMPORTANT: Use ${promptLanguage} for all string fields (like title, suggestions, and ingredients). Numbers stay as numbers.
          ONLY return the JSON, no other text.`;

          const result = await model.generateContent({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { data: base64Image, mimeType: file.type } }
              ]
            }]
          });
          const response = await result.response;
          const text = response.text();

          console.log('Raw photo analysis response:', text);

          // Clean the response - extract only the JSON part
          let cleanedText = text;
          if (text.includes("```")) {
            cleanedText = text.replace(/```(?:json)?\n([\s\S]*?)```/g, "$1").trim();
          }

          console.log('Cleaned photo analysis text:', cleanedText);

          const analysis = JSON.parse(cleanedText);
          console.log('Parsed photo analysis data:', analysis);

          // Comprehensive validation of the analysis data
          if (!analysis.isFood) {
            if (!analysis.error) {
              throw new Error('Invalid response: missing error message for non-food item');
            }
          } else {
            // Validate required fields for food items
            const requiredFields = ['title', 'calories', 'protein', 'carbs', 'fat', 'score', 'suggestions', 'ingredients'];
            const missingFields = requiredFields.filter(field => {
              const value = analysis[field];
              return value === undefined || value === null ||
                (typeof value === 'string' && !value.trim()) ||
                (Array.isArray(value) && value.length === 0);
            });

            if (missingFields.length > 0) {
              throw new Error(`Invalid response: missing required fields: ${missingFields.join(', ')}`);
            }

            // Ensure numeric fields are valid numbers
            ['calories', 'protein', 'carbs', 'fat', 'score'].forEach(field => {
              const value = analysis[field];
              if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(`Invalid response: ${field} must be a valid number`);
              }
            });

            // Ensure arrays are valid
            if (!Array.isArray(analysis.suggestions) || !Array.isArray(analysis.ingredients)) {
              throw new Error('Invalid response: suggestions and ingredients must be arrays');
            }
          }

          setPhotoAnalysisResult(analysis);

        } catch (error) {
          console.error('Failed to parse AI response:', error);
          setPhotoAnalysisResult({
            isFood: false,
            error: t('mealAnalysis.errors.photoAnalyzeFailed')
          } as AnalysisResult);
        } finally {
          setIsPhotoAnalyzing(false);
        }
      };

      reader.onerror = () => {
        setPhotoAnalysisResult({
          isFood: false,
          error: t('mealAnalysis.errors.fileReadFailed')
        } as AnalysisResult);
        setIsPhotoAnalyzing(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Photo analysis error:", error);
      setPhotoAnalysisResult({
        isFood: false,
        error: error.message === 'Quota reached'
          ? t('mealAnalysis.errors.quotaReached')
          : t('mealAnalysis.errors.photoAnalyzeTryAgain')
      } as AnalysisResult);
      setIsPhotoAnalyzing(false);
    }
  };

  const handleCalculateNutrition = async () => {
    setIsCalculating(true);
    setAnalysisWarning(null);
    try {
      // Get real-time pro status from Firestore
      const userDoc = await getDoc(doc(db, "users", auth.currentUser?.uid));
      const isPro = userDoc.exists() ? userDoc.data().isPro || false : false;

      console.log('Checking meal analysis quota:', {
        isPro,
        dailyMealAnalysis,
        limit: 3
      });

      // Check if user is not pro and has reached quota
      if (!isPro && dailyMealAnalysis >= 3) {
        const event = new CustomEvent('showErrorToast', {
          detail: { message: t('mealAnalysis.errors.quotaToast') }
        });
        window.dispatchEvent(event);
        throw new Error('Quota reached');
      }

      // Increment quota counter BEFORE starting analysis for non-pro users
      if (!isPro) {
        console.log('Incrementing meal analysis quota for free user');
        incrementMealAnalysis();
      }

      const analysis = await analyzeNutrition(newFood.description);
      setNewFood(prev => ({ ...prev, ...analysis }));
      // Generate recommendations automatically after nutrition calculation
      generateRecommendations({
        id: crypto.randomUUID(),
        description: newFood.description,
        foodName: newFood.description,
        calories: analysis.calories,
        protein: analysis.protein,
        carbs: analysis.carbs,
        fat: analysis.fat,
        healthScore: analysis.healthScore,
        mealTag: newFood.mealTag,
        timestamp: new Date().toISOString(),
        warning: analysis.warning
      });
    } catch (error) {
      if (error.message !== 'Quota reached') {
        setAnalysisWarning(t('mealAnalysis.errors.nutritionAnalyzeFailed'));
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const generateRecommendations = async (food: any) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Analyze this meal and provide recommendations for improvement:
      Food: ${food.description}
      Calories: ${food.calories}
      Protein: ${food.protein}g
      Carbs: ${food.carbs}g
      Fat: ${food.fat}g
      Health Score: ${food.healthScore}

      Provide recommendations in this exact JSON format:
      {
        "add": ["item1", "item2"],
        "remove": ["item1", "item2"],
        "explanation": "Brief explanation",
        "adjustedScore": number,
        "adjustedNutrition": {
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number
        }
      }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      try {
        const recommendations = JSON.parse(text);
        setRecommendations(recommendations);
      } catch (error) {
        console.error('Failed to parse recommendations:', error);
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  };

  // Add this before the return statement
  const renderExtraNutrients = (result: AnalysisResult, isPro: boolean) => {
    if (!isPro) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 space-y-3"
        >
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/30 bg-gradient-to-b from-amber-50/50 to-white p-6 shadow-xl">
            <motion.div
              animate={{
                opacity: [0.1, 0.15, 0.1],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="absolute inset-0 bg-gradient-to-br from-amber-200/20 via-yellow-100/10 to-amber-50/5 pointer-events-none"
            />
            <div className="relative z-10 flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-200/50">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('mealAnalysis.pro.unlockDetailedNutrition.title')}</h3>
              <p className="text-sm text-gray-600 max-w-[280px]">
                {t('mealAnalysis.pro.unlockDetailedNutrition.description')}
              </p>
              <button
                onClick={() => setIsProPanelOpen(true)}
                className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium shadow-lg shadow-amber-200/50 hover:opacity-90 transition-opacity"
              >
                {t('mealAnalysis.pro.unlockDetailedNutrition.cta')}
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
            <Utensils className="w-4 h-4 text-[#007AFF]" />
            {t('mealAnalysis.additionalNutrients')}
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t('mealAnalysis.labels.fiber'), value: result.fiber || 0, unit: "g", icon: "🌱" },
            { label: t('mealAnalysis.labels.sugar'), value: result.sugar, unit: "g", icon: "🍯" },
            { label: t('mealAnalysis.labels.sodium'), value: result.sodium || 0, unit: "mg", icon: "🧂" },
            { label: t('mealAnalysis.labels.cholesterol'), value: result.cholesterol, unit: "mg", icon: "🥚" }
          ].map((nutrient, i) => (
            <div key={nutrient.label} className="bg-white/5 rounded-xl p-3.5 flex items-center gap-3 shadow-sm backdrop-blur-sm">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center flex-shrink-0 border border-white/5">
                <span className="text-sm">{nutrient.icon}</span>
              </div>
              <div>
                <div className={`${fontStyles.caption} text-[#1d1d1f]/70 dark:text-white/60`}>
                  {nutrient.label}
                </div>
                <div className={`text-base ${fontStyles.subheading} text-[#1d1d1f] dark:text-white`}>
                  {nutrient.value}{nutrient.unit}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(result.vitaminA || result.vitaminC || result.calcium || result.iron) && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              { label: t('mealAnalysis.labels.vitA'), value: result.vitaminA || 0, unit: "%" },
              { label: t('mealAnalysis.labels.vitC'), value: result.vitaminC || 0, unit: "%" },
              { label: t('mealAnalysis.labels.calcium'), value: result.calcium || 0, unit: "%" },
              { label: t('mealAnalysis.labels.iron'), value: result.iron || 0, unit: "%" }
            ].map((vitamin, i) => (
              <div key={vitamin.label} className="bg-white/5 rounded-lg p-2.5 text-center shadow-sm backdrop-blur-sm">
                <div className={`${fontStyles.caption} text-[#1d1d1f]/70 dark:text-white/60`}>
                  {vitamin.label}
                </div>
                <div className={`text-sm ${fontStyles.subheading} text-[#1d1d1f] dark:text-white`}>
                  {vitamin.value}{vitamin.unit}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  // Add this before the return statement
  const renderSuggestions = (result: AnalysisResult, isPro: boolean) => {
    if (!isPro) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 space-y-3"
        >
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/30 bg-gradient-to-b from-amber-50/50 to-white p-6 shadow-xl">
            <motion.div
              animate={{
                opacity: [0.1, 0.15, 0.1],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="absolute inset-0 bg-gradient-to-br from-amber-200/20 via-yellow-100/10 to-amber-50/5 pointer-events-none"
            />
            <div className="relative z-10 flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-200/50">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('mealAnalysis.pro.unlockAISuggestions.title')}</h3>
              <p className="text-sm text-gray-600 max-w-[280px]">
                {t('mealAnalysis.pro.unlockAISuggestions.description')}
              </p>
              <button
                onClick={() => setIsProPanelOpen(true)}
                className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium shadow-lg shadow-amber-200/50 hover:opacity-90 transition-opacity"
              >
                {t('mealAnalysis.pro.unlockAISuggestions.cta')}
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4 space-y-3"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`suggestions-${showAllSuggestions ? 'expanded' : 'collapsed'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-2.5"
          >
            {result.suggestions.slice(0, showAllSuggestions ? result.suggestions.length : 3).map((suggestion, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.1 * Math.min(i, 5) }}
                className="bg-white/5 p-4 rounded-xl shadow-md backdrop-blur-sm flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#007AFF]/20 to-[#0055FF]/5 flex items-center justify-center flex-shrink0 mt-0.5 border border-[#007AFF]/20">
                  <span className={`text-xs ${fontStyles.heading} text-[#007AFF]`}>{i + 1}</span>
                </div>
                <p className={`flex-1 ${fontStyles.body} text-[#1d1d1f] dark:text-white/90`}>{suggestion}</p>
              </motion.div>
            ))}
            {!showAllSuggestions && result.suggestions.length > 3 && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                onClick={() => setShowAllSuggestions(true)}
                className={`w-full bg-white/5 p-3 rounded-xl ${fontStyles.button} text-[#007AFF] flex items-center justify-center gap-1.5 shadow-sm backdrop-blur-sm`}
              >
                <Plus className="w-4 h-4" />
                {t('mealAnalysis.viewMoreSuggestions', { count: result.suggestions.length - 3 })}
              </motion.button>
            )}
            {showAllSuggestions && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                onClick={() => setShowAllSuggestions(false)}
                className={`w-full bg-white/5 p-3 rounded-xl ${fontStyles.button} text-[#007AFF] flex items-center justify-center gap-1.5 shadow-sm backdrop-blur-sm`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('mealAnalysis.viewLess')}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    );
  };

  const resetForm = () => {
    setSelectedTag("");
    setCustomTag("");
    setMealTitle("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setIsManualEntry(false);
    setIsAIDescription(false);
    setIsSnapPhoto(false);
    setDescription("");
    setAnalysisResult(null);
    setShowInput(true);
    setShowAllIngredients(false);
    setShowAllSuggestions(false);
    setSelectedFile(null);
    setPhotoAnalysisResult(null);
    setIsPhotoAnalyzing(false);
    setShowPhotoInput(true);
  };

  const isFormValid = mealTitle &&
    calories &&
    protein &&
    carbs &&
    fat &&
    (selectedTag || customTag);

  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    setShowInput(false);

    try {
      // Get real-time pro status from Firestore
      let isPro = false;
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const userDoc = await getDoc(doc(db, "users", uid));
          isPro = userDoc.exists() ? userDoc.data().isPro || false : false;
        } else {
          console.warn("analyzeWithAI: no authenticated user; defaulting isPro=false");
        }
      } catch (userFetchErr) {
        console.warn("analyzeWithAI: failed to fetch user doc; defaulting isPro=false", userFetchErr);
        isPro = false;
      }

      console.log('Checking meal analysis quota:', {
        isPro,
        dailyMealAnalysis,
        limit: 3
      });

      // Check if user is not pro and has reached quota
      if (!isPro && dailyMealAnalysis >= 3) {
        const event = new CustomEvent('showErrorToast', {
          detail: { message: t('mealAnalysis.errors.quotaToast') }
        });
        window.dispatchEvent(event);
        throw new Error('Quota reached');
      }

      // Increment quota counter BEFORE starting analysis for non-pro users
      if (!isPro) {
        console.log('Incrementing meal analysis quota for free user');
        incrementMealAnalysis();
      }

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const promptLanguage = i18n.language?.startsWith('ar') ? 'Arabic' : 'English';

      const prompt = `Analyze this meal description and provide detailed nutritional information.
      If this is not a food, meal, or drink, respond with { "isFood": false, "error": "reason" }.

      Description: "${description}"
      This informations will help you generating nice and suitable suggestions:
      User Profile:
      Age: ${user?.age || "N/A"}
      Gender: ${user?.gender || "N/A"}
      Weight: ${user?.weight || "N/A"}kg/lbs
      Height: ${user?.height || "N/A"}cm/ft
      Daily Calorie Goal: ${user?.calorieGoal || "N/A"}
      Protein Goal: ${user?.proteinGoal || "N/A"}g
      Carbs Goal: ${user?.carbsGoal || "N/A"}g
      Fat Goal: ${user?.fatGoal || "N/A"}g
      Allergies: ${user?.allergies?.join(", ") || "None"}
      Diet Preferences: ${user?.dietaryPreferences?.join(", ") || "None"}
      Cuisine Preferences: ${user?.cuisinePreferences?.join(", ") || "None"}

      IMPORTANT: Return ONLY the raw JSON object with no markdown formatting, code blocks, or additional text.
      
      If this is food/drink, respond with a JSON object:
      {
        "isFood": true,
        "title": "Brief very short title",
        "calories": exact_number,
        "protein": nearest_gram,
        "carbs": nearest_gram,
        "fat": nearest_gram,
        "cholesterol": mg,
        "magnesium": mg,
        "sugar": grams,
        "fiber": grams,
        "sodium": mg,
        "potassium": mg,
        "vitaminA": percentage_of_daily_value,
        "vitaminC": percentage_of_daily_value,
        "calcium": percentage_of_daily_value,
        "iron": percentage_of_daily_value,
        "score": 0-100_based_on_health_and_goals,
        "suggestions": ["improvement suggestions"],
        "ingredients": ["detected ingredients"]
      }
      IMPORTANT: Use ${promptLanguage} for all string fields (like title, suggestions, and ingredients). Numbers stay as numbers. Return ONLY raw JSON.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Raw AI response:', text);

      try {
        // Clean the response text to handle markdown code blocks
        let cleanedText = text;

        // Remove markdown code blocks if present
        if (text.includes("```")) {
          cleanedText = text.replace(/```(?:json)?\n([\s\S]*?)```/g, "$1").trim();
        }

        console.log('Cleaned response text:', cleanedText);

        const analysisData = JSON.parse(cleanedText);
        console.log('Parsed analysis data:', analysisData);

        // Validate the analysis data structure
        if (!analysisData.isFood) {
          if (!analysisData.error) {
            throw new Error('Invalid response: missing error message for non-food item');
          }
        } else {
          // Validate required fields for food items
          const requiredFields = ['title', 'calories', 'protein', 'carbs', 'fat', 'score', 'suggestions', 'ingredients'];
          const missingFields = requiredFields.filter(field => {
            const value = analysisData[field];
            return value === undefined || value === null ||
              (typeof value === 'string' && !value.trim()) ||
              (Array.isArray(value) && value.length === 0);
          });

          if (missingFields.length > 0) {
            throw new Error(`Invalid response: missing required fields: ${missingFields.join(', ')}`);
          }

          // Ensure numeric fields are valid numbers
          ['calories', 'protein', 'carbs', 'fat', 'score'].forEach(field => {
            const value = analysisData[field];
            if (typeof value !== 'number' || isNaN(value)) {
              throw new Error(`Invalid response: ${field} must be a valid number`);
            }
          });

          // Ensure arrays are valid
          if (!Array.isArray(analysisData.suggestions) || !Array.isArray(analysisData.ingredients)) {
            throw new Error('Invalid response: suggestions and ingredients must be arrays');
          }
        }

        setAnalysisResult(analysisData);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        console.log("Raw response:", text);
        setAnalysisResult({
          isFood: false,
          error: "Failed to analyze the meal. The AI response was not in the expected format."
        } as AnalysisResult);
      }
    } catch (error) {
      console.error("AI analysis error:", error);
      setAnalysisResult({
        isFood: false,
        error: "Failed to analyze the meal. Please try again."
      } as AnalysisResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = () => {
    if (!isFormValid) return;

    const entry = {
      description: mealTitle,
      foodName: mealTitle,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      mealTag: selectedTag || customTag || t('mealAnalysis.tags.meal1'),
      timestamp: new Date().toISOString(),
      healthScore: 50,
      year: new Date().getFullYear() // Store the year for yearly meal tracking
    };

    console.log("Saving manual meal:", entry);
    addCalorieEntry(entry);

    // Show user feedback
    const event = new CustomEvent('showErrorToast', {
      detail: { message: t('mealAnalysis.saveSuccess') }
    });
    window.dispatchEvent(event);

    onClose();
    resetForm();
    // Show nav when closing
    document.dispatchEvent(new CustomEvent('setNavHide', { detail: { isHidden: false } }));

    // Add a small delay and then fire an event to tell Diet component to refresh
    setTimeout(() => {
      const refreshEvent = new CustomEvent('refreshDietPage');
      window.dispatchEvent(refreshEvent);
    }, 100);
  };

  const handleImprove = async (improveText: string) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Analyze this meal with the following improvement request and provide updated nutritional information.
      
      Original Meal Analysis:
      ${JSON.stringify(analysisResult, null, 2)}
      
      Improvement Request: "${improveText}"

      User Profile:
      Age: ${user?.age || "N/A"}
      Gender: ${user?.gender || "N/A"}
      Weight: ${user?.weight || "N/A"}kg/lbs
      Height: ${user?.height || "N/A"}cm/ft
      Daily Calorie Goal: ${user?.calorieGoal || "N/A"}
      Protein Goal: ${user?.proteinGoal || "N/A"}g
      Carbs Goal: ${user?.carbsGoal || "N/A"}g
      Fat Goal: ${user?.fatGoal || "N/A"}g
      Allergies: ${user?.allergies?.join(", ") || "None"}
      Diet Preferences: ${user?.dietaryPreferences?.join(", ") || "None"}
      Cuisine Preferences: ${user?.cuisinePreferences?.join(", ") || "None"}

      IMPORTANT: Return ONLY the raw JSON object with no markdown formatting, code blocks, or additional text.
      
      Respond with a JSON object:
      {
        "isFood": true,
        "title": "Brief very short title",
        "calories": exact_number,
        "protein": nearest_gram,
        "carbs": nearest_gram,
        "fat": nearest_gram,
        "cholesterol": mg,
        "magnesium": mg,
        "sugar": grams,
        "fiber": grams,
        "sodium": mg,
        "potassium": mg,
        "vitaminA": percentage_of_daily_value,
        "vitaminC": percentage_of_daily_value,
        "calcium": percentage_of_daily_value,
        "iron": percentage_of_daily_value,
        "score": 0-100_based_on_health_and_goals,
        "suggestions": ["improvement suggestions"],
        "ingredients": ["detected ingredients"]
      }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Raw AI improvement response:', text);

      try {
        // Clean the response text to handle markdown code blocks
        let cleanedText = text;

        // Remove markdown code blocks if present
        if (text.includes("```")) {
          cleanedText = text.replace(/```(?:json)?\n([\s\S]*?)```/g, "$1").trim();
        }

        console.log('Cleaned improvement response:', cleanedText);

        const improvedAnalysis = JSON.parse(cleanedText);
        console.log('Parsed improvement data:', improvedAnalysis);

        // Validate the analysis data structure
        if (!improvedAnalysis.isFood) {
          throw new Error('Invalid response: not a food item');
        }

        // Validate required fields
        const requiredFields = ['title', 'calories', 'protein', 'carbs', 'fat', 'score', 'suggestions', 'ingredients'];
        const missingFields = requiredFields.filter(field => {
          const value = improvedAnalysis[field];
          return value === undefined || value === null ||
            (typeof value === 'string' && !value.trim()) ||
            (Array.isArray(value) && value.length === 0);
        });

        if (missingFields.length > 0) {
          throw new Error(`Invalid response: missing required fields: ${missingFields.join(', ')}`);
        }

        // Ensure numeric fields are valid numbers
        ['calories', 'protein', 'carbs', 'fat', 'score'].forEach(field => {
          const value = improvedAnalysis[field];
          if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`Invalid response: ${field} must be a valid number`);
          }
        });

        // Ensure arrays are valid
        if (!Array.isArray(improvedAnalysis.suggestions) || !Array.isArray(improvedAnalysis.ingredients)) {
          throw new Error('Invalid response: suggestions and ingredients must be arrays');
        }

        setAnalysisResult(improvedAnalysis);

      } catch (parseError) {
        console.error("Failed to parse AI improvement response:", parseError);
        throw new Error("Failed to improve the meal analysis. The AI response was not in the expected format.");
      }
    } catch (error) {
      console.error("AI improvement error:", error);
      throw new Error("Failed to improve the meal analysis. Please try again.");
    }
  };

  return (
    <>
      <MealAnalysisAnimate isOpen={isOpen} onClose={handleClose}>
        <motion.div
          className="bg-[#f5f5f7] dark:bg-[#1c1c1e] rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] relative flex flex-col"
          animate={{
            height: isManualEntry || isAIDescription || isSnapPhoto
              ? isAIDescription
                ? isAnalyzing || analysisResult
                  ? "78vh"
                  : "44vh"
                : isSnapPhoto
                  ? isPhotoAnalyzing || photoAnalysisResult
                    ? "78vh"
                    : "40vh"
                  : "65vh"
              : "30vh"
          }}
          transition={{
            duration: 0.6,
            ease: [0.23, 1, 0.32, 1]
          }}
        >
          <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 bg-black/10 dark:bg-white/20 rounded-full" />
          </div>

          <AnimatePresence mode="wait">
            {!isManualEntry && !isAIDescription && !isSnapPhoto ? (
              <motion.div
                key="options"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "flex-1 overflow-y-auto overscroll-contain px-4",
                  isDragging && "pointer-events-none"
                )}
              >
                <div className="grid grid-cols-2 gap-2.5 py-2">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={handleSnapPhotoClick}
                    className="bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <Camera className="w-6 h-6 text-[#007AFF]" />
                    <span className="text-sm font-medium text-[#1d1d1f] dark:text-white/90">{t('mealAnalysis.actions.snapPhoto')}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={handleAIDescriptionClick}
                    className="bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <Sparkles className="w-6 h-6 text-[#007AFF]" />
                    <span className="text-sm font-medium text-[#1d1d1f] dark:text-white/90">{t('mealAnalysis.actions.aiDescription')}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={handleManualEntryClick}
                    className="bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <Pencil className="w-6 h-6 text-[#007AFF]" />
                    <span className="text-sm font-medium text-[#1d1d1f] dark:text-white/90">{t('mealAnalysis.actions.manualEntry')}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={handleSearchClick}
                    className="bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <Search className="w-6 h-6 text-[#007AFF]" />
                    <span className="text-sm font-medium text-[#1d1d1f] dark:text-white/90">{t('mealAnalysis.actions.searchFood')}</span>
                  </motion.button>
                </div>
              </motion.div>
            ) : isAIDescription ? (
              <motion.div
                key="ai-description"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24"
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={handleBackClick}
                    className="text-[#007AFF] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('common.back')}
                  </button>
                  <h2 className="text-lg font-semibold text-center font-sf-display text-[#1d1d1f] dark:text-white">
                    {t('mealAnalysis.headers.aiDescription')}
                  </h2>
                  <div className="w-[32px]" />
                </div>

                <AnimatePresence mode="wait">
                  {showInput && !isAnalyzing && !analysisResult && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.45,
                        ease: 'easeOut'
                      }}
                      className="space-y-0"
                    >
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.45,
                          ease: 'easeOut'
                        }}
                        className="bg-gradient-to-br from-white/[0.05] to-transparent p-2.5 pb-0 rounded-t-2xl border border-black/5 dark:border-white/10 space-y-1.5 border-b-0"
                      >
                        <label className={`block ${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                          <Utensils className="w-4 h-4 text-[#007AFF]" />
                          {t('mealAnalysis.ai.describeYourMeal')}
                        </label>
                        <motion.textarea
                          placeholder={t('mealAnalysis.ai.examplePlaceholder')}
                          value={description}
                          onChange={(e) => {
                            const words = e.target.value.trim().split(/\s+/);
                            if (words.length <= 300) {
                              setDescription(e.target.value);
                            }
                          }}
                          className={`w-full min-h-[100px] max-h-[160px] px-3 py-2.5 rounded-xl bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] text-[#1d1d1f] dark:text-white/90 transition-all duration-200 resize-none overflow-y-auto ${fontStyles.body}`}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.45,
                          ease: 'easeOut',
                          delay: 0.05
                        }}
                        className="bg-gradient-to-br from-white/[0.05] to-transparent p-2.5 pt-1 rounded-b-2xl border border-black/5 dark:border-white/10 mt-0 border-t-0"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <label className={`block ${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                            <Tag className="w-4 h-4 text-[#007AFF]" />
                            {t('mealAnalysis.ai.selectMealType')}
                          </label>
                          {selectedTag && (
                            <span className={`${fontStyles.caption} text-[#007AFF]`}>
                              {selectedTag === "custom" ? customTag : selectedTag}
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-hide">
                          <div className="flex gap-2 min-w-max">
                            {tags.map((tag) => (
                              <motion.button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                  `px-3 py-1.5 rounded-lg ${fontStyles.button} transition-all duration-300 flex-shrink-0`,
                                  selectedTag === tag
                                    ? "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                                    : "bg-white/80 dark:bg-white/10 text-[#1d1d1f] dark:text-white/90 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.15]"
                                )}
                              >
                                {tag}
                              </motion.button>
                            ))}
                            {savedTags.map((tag) => (
                              <motion.button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                  `px-3 py-1.5 rounded-lg ${fontStyles.button} transition-all duration-300 flex-shrink-0`,
                                  selectedTag === tag
                                    ? "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                                    : "bg-white/80 dark:bg-white/10 text-[#1d1d1f] dark:text-white/90 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.15]"
                                )}
                              >
                                {tag}
                              </motion.button>
                            ))}
                            <motion.button
                              onClick={() => setSelectedTag("custom")}
                              whileTap={{ scale: 0.95 }}
                              className={cn(
                                `px-3 py-1.5 rounded-lg ${fontStyles.button} transition-all duration-300 flex-shrink-0`,
                                selectedTag === "custom"
                                  ? "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                                  : "bg-white/80 dark:bg-white/10 text-[#1d1d1f] dark:text-white/90 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.15]"
                              )}
                            >
                              <Plus className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </div>
                        <AnimatePresence mode="wait">
                          {selectedTag === "custom" && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="flex gap-2 mt-2"
                            >
                              <motion.input
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                type="text"
                                placeholder={t('mealAnalysis.tags.customPlaceholder')}
                                value={customTag}
                                onChange={(e) => setCustomTag(e.target.value)}
                                className={`flex-1 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] text-[#1d1d1f] dark:text-white/90 transition-all duration-200 ${fontStyles.body}`}
                              />
                              <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={handleSaveCustomTag}
                                disabled={!customTag}
                                className={cn(
                                  `px-3 py-1.5 rounded-lg ${fontStyles.button} transition-all duration-300`,
                                  "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  "hover:from-[#0066FF] hover:to-[#0044FF]",
                                  "active:scale-[0.98]"
                                )}
                              >
                                {t('common.save')}
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Close the Tag block and the AI input wrapper */}
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Loading state while analyzing */}
                  {isAnalyzing && (
                    <motion.div
                      className="flex flex-col items-center justify-center h-[78vh] -mt-20 space-y-6"
                    >
                      <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#007AFF]/10 to-[#0055FF]/5"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-[#007AFF]/10"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-[#007AFF] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-[#007AFF] animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-2 text-center">
                        <p className={`text-base ${fontStyles.subheading} text-[#1d1d1f] dark:text-white`}>
                          {t('mealAnalysis.ai.analyzing')}
                        </p>
                        <p className={`${fontStyles.caption} text-[#1d1d1f]/60 dark:text-white/60 max-w-[280px]`}>
                          {t('mealAnalysis.ai.calculatingMessage')}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {analysisResult && !isAnalyzing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6 mt-4 pb-24"
                    >
                      {analysisResult.isFood ? (
                        <>
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="bg-gradient-to-br from-white/10 to-transparent p-6 rounded-2xl border border-white/10 shadow-xl backdrop-blur-sm"
                          >
                            <h3 className={`text-xl ${fontStyles.heading} text-[#1d1d1f] dark:text-white mb-3 truncate`}>
                              {analysisResult.title}
                            </h3>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-baseline gap-2">
                                  <Flame className="w-5 h-5 text-[#FF9500]" />
                                  <span className={`text-3xl ${fontStyles.heading} bg-gradient-to-r from-[#FF9500] to-[#FF2D55] bg-clip-text text-transparent`}>
                                    {analysisResult.calories}
                                  </span>
                                  <span className={`${fontStyles.caption} text-[#1d1d1f] dark:text-white/60`}>
                                    {t('mealAnalysis.labels.calories')}
                                  </span>
                                </div>
                              </div>
                              <div className="h-12 w-px bg-white/10"></div>
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF]/20 to-[#0055FF]/10 flex items-center justify-center">
                                  <span className={`text-sm ${fontStyles.heading} text-[#007AFF]`}>
                                    {analysisResult.score}
                                  </span>
                                </div>
                                <span className={`${fontStyles.caption} text-[#1d1d1f]/60 dark:text-white/60`}>
                                  {t('mealAnalysis.labels.healthScore')}
                                </span>
                              </div>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
                            className="space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                                <BarChart3 className="w-4 h-4 text-[#007AFF]" />
                                {t('mealAnalysis.labels.macronutrients')}
                              </h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: t('mealAnalysis.labels.protein'), value: analysisResult.protein, unit: t('mealAnalysis.units.gramShort'), color: "from-[#32D74B] to-[#32D74B]", icon: "💪" },
                                { label: t('mealAnalysis.labels.carbs'), value: analysisResult.carbs, unit: t('mealAnalysis.units.gramShort'), color: "from-[#FF9F0A] to-[#FF9F0A]", icon: "🌾" },
                                { label: t('mealAnalysis.labels.fat'), value: analysisResult.fat, unit: t('mealAnalysis.units.gramShort'), color: "from-[#FF375F] to-[#FF375F]", icon: "🥑" }
                              ].map((macro, i) => (
                                <div key={macro.label} className="bg-white/10 dark:bg-white/5 rounded-xl p-3.5 text-center shadow-md backdrop-blur-sm">
                                  <div className="flex justify-center mb-1.5">
                                    <span className="text-lg">{macro.icon}</span>
                                  </div>
                                  <div className={`text-xl ${fontStyles.heading} bg-gradient-to-r ${macro.color} bg-clip-text text-transparent`}>
                                    {macro.value}{macro.unit}
                                  </div>
                                  <div className={`${fontStyles.caption} text-[#1d1d1f] dark:text-white/60 mt-0.5`}>
                                    {macro.label}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {renderExtraNutrients(analysisResult, user?.isPro || false)}
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
                            className="space-y-3"
                          >
                            <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                              <Utensils className="w-4 h-4 text-[#007AFF]" />
                              {t('mealAnalysis.labels.ingredients')}
                            </h4>
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={`ingredients-${showAllIngredients ? 'expanded' : 'collapsed'}`}
                                initial={{ opacity: 0, height: showAllIngredients ? 0 : "auto" }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                className="flex flex-wrap gap-2"
                              >
                                {analysisResult.ingredients.slice(0, showAllIngredients ? analysisResult.ingredients.length : 8).map((ingredient, i) => (
                                  <motion.div
                                    key={ingredient}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.05 * Math.min(i, 10) }}
                                    className={`bg-white/5 px-3.5 py-2 rounded-lg ${fontStyles.body} text-[#1d1d1f] dark:text-white/90 shadow-sm backdrop-blur-sm`}
                                  >
                                    {ingredient}
                                  </motion.div>
                                ))}
                                {!showAllIngredients && analysisResult.ingredients.length > 8 && (
                                  <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                                    onClick={() => setShowAllIngredients(true)}
                                    className={`bg-white/5 px-3.5 py-2 rounded-lg ${fontStyles.body} text-[#007AFF] flex items-center gap-1 shadow-sm backdrop-blur-sm`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    {analysisResult.ingredients.length - 8} {t('mealAnalysis.labels.more')}
                                  </motion.button>
                                )}
                                {showAllIngredients && (
                                  <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                                    onClick={() => setShowAllIngredients(false)}
                                    className={`bg-white/5 px-3.5 py-2 rounded-lg ${fontStyles.body} text-[#007AFF] flex items-center gap-1 shadow-sm backdrop-blur-sm ml-auto mt-2`}
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    {t('mealAnalysis.labels.viewLess')}
                                  </motion.button>
                                )}
                              </motion.div>
                            </AnimatePresence>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                            className="space-y-3 mb-24"
                          >
                            <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                              <Sparkles className="w-4 h-4 text-[#007AFF]" />
                              {t('mealAnalysis.labels.suggestions')}
                            </h4>
                            {renderSuggestions(analysisResult, user?.isPro || false)}
                          </motion.div>

                          <motion.div
                            className="fixed bottom-0 left-0 right-0 p-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] border-t border-black/5 dark:border-white/10 backdrop-blur-md z-50"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.6,
                              ease: [0.23, 1, 0.32, 1],
                              delay: 0.5
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={handleSaveAnalyzedMeal}
                                className={`flex-1 h-12 rounded-xl ${fontStyles.button} transition-all duration-300 
                                      bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white
                                      active:scale-[0.98] shadow-lg shadow-blue-500/25`}
                              >
                                {t('mealAnalysis.buttons.saveMeal')}
                              </button>
                              <ImproveAI
                                onClick={() => { }}
                                analysisResult={analysisResult}
                                onImprove={handleImprove}
                              />
                            </div>
                          </motion.div>
                        </>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                          className="bg-white/5 dark:bg-white/5 border border-red-500/20 rounded-2xl p-6 flex flex-col items-center h-[50vh] justify-center shadow-xl backdrop-blur-sm"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/10 to-transparent flex items-center justify-center mb-5 border border-red-500/20">
                            <X className="w-8 h-8 text-red-500" />
                          </div>
                          <h3 className={`text-lg ${fontStyles.heading} text-[#1d1d1f] dark:text-white mb-2 text-center`}>
                            {t('mealAnalysis.errors.analyzeMealFailed')}
                          </h3>
                          <p className={`${fontStyles.body} text-[#1d1d1f]/70 dark:text-white/70 text-center mb-6 max-w-[280px]`}>
                            {analysisResult.error || t('mealAnalysis.errors.tryDetailedDescription')}
                          </p>
                          <button
                            onClick={() => {
                              setAnalysisResult(null);
                              setShowInput(true);
                            }}
                            className={`px-6 py-3 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white ${fontStyles.button} transition-all duration-300 hover:shadow-lg active:scale-[0.98] shadow-md`}
                          >
                            {t('common.tryAgain')}
                          </button>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {showInput && !isAnalyzing && !analysisResult && (
                  <motion.div
                    className="fixed bottom-0 left-0 right-0 p-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] border-t border-black/5 dark:border-white/10 backdrop-blur-md z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.45,
                      ease: 'easeOut'
                    }}
                  >
                    <button
                      onClick={analyzeWithAI}
                      disabled={!description.trim() || (!selectedTag && !customTag)}
                      className={cn(
                        `w-full h-12 rounded-xl ${fontStyles.button} transition-all duration-300`,
                        "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "active:scale-[0.98]",
                        "shadow-lg shadow-blue-500/25",
                        (!description.trim() || (!selectedTag && !customTag)) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {!description.trim()
                        ? t('mealAnalysis.ai.enterDescription')
                        : (!selectedTag && !customTag)
                          ? t('mealAnalysis.ai.selectMealType')
                          : t('mealAnalysis.ai.analyzeFood')}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ) : isSnapPhoto ? (
              <motion.div
                key="snap-photo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24"
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={handleBackClick}
                    className="text-[#007AFF] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('common.back')}
                  </button>
                  <h2 className="text-lg font-semibold text-center font-sf-display text-[#1d1d1f] dark:text-white">
                    {t('mealAnalysis.headers.uploadPhoto')}
                  </h2>
                  <div className="w-[32px]" />
                </div>

                <AnimatePresence mode="wait">
                  {showPhotoInput && !isPhotoAnalyzing && !photoAnalysisResult && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.45,
                        ease: 'easeOut'
                      }}
                      className="flex flex-col items-center justify-center h-[40vh] -mt-10"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />
                      <div className="flex flex-col gap-4 w-full max-w-[280px]">
                        <motion.button
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.removeAttribute('capture');
                              fileInputRef.current.click();
                            }
                          }}
                          className="relative group w-full h-[90px] rounded-2xl bg-gradient-to-br from-[#007AFF]/5 to-transparent border-2 border-dashed border-[#007AFF]/20 hover:border-[#007AFF]/40 transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#007AFF]/10 to-transparent border border-[#007AFF]/10 flex items-center justify-center">
                            <Search className="w-5 h-5 text-[#007AFF]" />
                          </div>
                          <div className="text-center">
                            <p className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white text-sm`}>
                              {t('mealAnalysis.photo.chooseFromLibrary')}
                            </p>
                          </div>
                        </motion.button>

                        <motion.button
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.setAttribute('capture', 'environment');
                              fileInputRef.current.click();
                            }
                          }}
                          className="relative group w-full h-[90px] rounded-2xl bg-gradient-to-br from-[#007AFF]/5 to-transparent border-2 border-dashed border-[#007AFF]/20 hover:border-[#007AFF]/40 transition-all duration-300 flex flex-col items-center justify-center gap-2 overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#007AFF]/10 to-transparent border border-[#007AFF]/10 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-[#007AFF]" />
                          </div>
                          <div className="text-center">
                            <p className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white text-sm`}>
                              {t('mealAnalysis.photo.takePhoto')}
                            </p>
                          </div>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {isPhotoAnalyzing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="flex flex-col items-center justify-center h-[78vh] -mt-20 space-y-6"
                    >
                      <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#007AFF]/10 to-[#0055FF]/5"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-[#007AFF]/10"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-[#007AFF] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-[#007AFF] animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-2 text-center">
                        <p className={`text-base ${fontStyles.subheading} text-[#1d1d1f] dark:text-white`}>
                          {t('mealAnalysis.photo.analyzing')}
                        </p>
                        <p className={`${fontStyles.caption} text-[#1d1d1f]/60 dark:text-white/60 max-w-[280px]`}>
                          {t('mealAnalysis.photo.calculatingMessage')}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {photoAnalysisResult && !isPhotoAnalyzing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6 mt-4 pb-24 overflow-y-auto"
                    >
                      {photoAnalysisResult.isFood ? (
                        <>
                          {/* Use exact same results UI as AI description */}
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="bg-gradient-to-br from-white/10 to-transparent p-6 rounded-2xl border border-white/10 shadow-xl backdrop-blur-sm"
                          >
                            <h3 className={`text-xl ${fontStyles.heading} text-[#1d1d1f] dark:text-white mb-3 truncate`}>
                              {photoAnalysisResult.title}
                            </h3>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-baseline gap-2">
                                  <Flame className="w-5 h-5 text-[#FF9500]" />
                                  <span className={`text-3xl ${fontStyles.heading} bg-gradient-to-r from-[#FF9500] to-[#FF2D55] bg-clip-text text-transparent`}>
                                    {photoAnalysisResult.calories}
                                  </span>
                                  <span className={`${fontStyles.caption} text-[#1d1d1f] dark:text-white/60`}>
                                    {t('mealAnalysis.labels.calories')}
                                  </span>
                                </div>
                              </div>
                              <div className="h-12 w-px bg-white/10"></div>
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007AFF]/20 to-[#0055FF]/10 flex items-center justify-center">
                                  <span className={`text-sm ${fontStyles.heading} text-[#007AFF]`}>
                                    {photoAnalysisResult.score}
                                  </span>
                                </div>
                                <span className={`${fontStyles.caption} text-[#1d1d1f]/60 dark:text-white/60`}>
                                  {t('mealAnalysis.labels.healthScore')}
                                </span>
                              </div>
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
                            className="space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                                <BarChart3 className="w-4 h-4 text-[#007AFF]" />
                                {t('mealAnalysis.labels.macronutrients')}
                              </h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: t('mealAnalysis.labels.protein'), value: photoAnalysisResult.protein, unit: t('mealAnalysis.units.gramShort'), color: "from-[#32D74B] to-[#32D74B]", icon: "💪" },
                                { label: t('mealAnalysis.labels.carbs'), value: photoAnalysisResult.carbs, unit: t('mealAnalysis.units.gramShort'), color: "from-[#FF9F0A] to-[#FF9F0A]", icon: "🌾" },
                                { label: t('mealAnalysis.labels.fat'), value: photoAnalysisResult.fat, unit: t('mealAnalysis.units.gramShort'), color: "from-[#FF375F] to-[#FF375F]", icon: "🥑" }
                              ].map((macro, i) => (
                                <div key={macro.label} className="bg-white/10 dark:bg-white/5 rounded-xl p-3.5 text-center shadow-md backdrop-blur-sm">
                                  <div className="flex justify-center mb-1.5">
                                    <span className="text-lg">{macro.icon}</span>
                                  </div>
                                  <div className={`text-xl ${fontStyles.heading} bg-gradient-to-r ${macro.color} bg-clip-text text-transparent`}>
                                    {macro.value}{macro.unit}
                                  </div>
                                  <div className={`${fontStyles.caption} text-[#1d1d1f] dark:text-white/60 mt-0.5`}>
                                    {macro.label}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {renderExtraNutrients(photoAnalysisResult, user?.isPro || false)}
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
                            className="space-y-3"
                          >
                            <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                              <Utensils className="w-4 h-4 text-[#007AFF]" />
                              {t('mealAnalysis.labels.ingredients')}
                            </h4>
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={`ingredients-${showAllIngredients ? 'expanded' : 'collapsed'}`}
                                initial={{ opacity: 0, height: showAllIngredients ? 0 : "auto" }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                className="flex flex-wrap gap-2"
                              >
                                {photoAnalysisResult.ingredients.slice(0, showAllIngredients ? photoAnalysisResult.ingredients.length : 8).map((ingredient, i) => (
                                  <motion.div
                                    key={ingredient}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.05 * Math.min(i, 10) }}
                                    className={`bg-white/5 px-3.5 py-2 rounded-lg ${fontStyles.body} text-[#1d1d1f] dark:text-white/90 shadow-sm backdrop-blur-sm`}
                                  >
                                    {ingredient}
                                  </motion.div>
                                ))}
                                {!showAllIngredients && photoAnalysisResult.ingredients.length > 8 && (
                                  <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                                    onClick={() => setShowAllIngredients(true)}
                                    className={`bg-white/5 px-3.5 py-2 rounded-lg ${fontStyles.body} text-[#007AFF] flex items-center gap-1 shadow-sm backdrop-blur-sm`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    {photoAnalysisResult.ingredients.length - 8} {t('mealAnalysis.labels.more')}
                                  </motion.button>
                                )}
                                {showAllIngredients && (
                                  <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                                    onClick={() => setShowAllIngredients(false)}
                                    className={`bg-white/5 px-3.5 py-2 rounded-lg ${fontStyles.body} text-[#007AFF] flex items-center gap-1 shadow-sm backdrop-blur-sm ml-auto mt-2`}
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    {t('mealAnalysis.viewLess')}
                                  </motion.button>
                                )}
                              </motion.div>
                            </AnimatePresence>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                            className="space-y-3 mb-24" // Add margin bottom to prevent overlap
                          >
                            <h4 className={`${fontStyles.subheading} text-[#1d1d1f] dark:text-white/90 flex items-center gap-1.5`}>
                              <Sparkles className="w-4 h-4 text-[#007AFF]" />
                              {t('mealAnalysis.labels.suggestions')}
                            </h4>
                            {renderSuggestions(photoAnalysisResult, user?.isPro || false)}
                          </motion.div>

                          <motion.div
                            className="fixed bottom-0 left-0 right-0 p-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] border-t border-black/5 dark:border-white/10 backdrop-blur-md z-50"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.6,
                              ease: [0.23, 1, 0.32, 1],
                              delay: 0.5
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={handleSavePhotoAnalyzedMeal}
                                className={`flex-1 h-12 rounded-xl ${fontStyles.button} transition-all duration-300 
                                      bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white
                                      active:scale-[0.98] shadow-lg shadow-blue-500/25`}
                              >
                                {t('mealAnalysis.buttons.saveMeal')}
                              </button>
                              <ImproveAI
                                onClick={() => { }}
                                analysisResult={photoAnalysisResult}
                                onImprove={handleImprove}
                              />
                            </div>
                          </motion.div>
                        </>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                          className="bg-white/5 dark:bg-white/5 border border-red-500/20 rounded-2xl p-6 flex flex-col items-center h-[50vh] justify-center shadow-xl backdrop-blur-sm"
                        >
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/10 to-transparent flex items-center justify-center mb-5 border border-red-500/20">
                            <X className="w-8 h-8 text-red-500" />
                          </div>
                          <h3 className={`text-lg ${fontStyles.heading} text-[#1d1d1f] dark:text-white mb-2 text-center`}>
                            {t('mealAnalysis.errors.analyzePhotoFailed')}
                          </h3>
                          <p className={`${fontStyles.body} text-[#1d1d1f]/70 dark:text-white/70 text-center mb-6 max-w-[280px]`}>
                            {photoAnalysisResult.error || t('mealAnalysis.errors.tryClearerPhoto')}
                          </p>
                          <button
                            onClick={() => {
                              setPhotoAnalysisResult(null);
                              setShowPhotoInput(true);
                            }}
                            className={`px-6 py-3 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white ${fontStyles.button} transition-all duration-300 hover:shadow-lg active:scale-[0.98] shadow-md`}
                          >
                            Try Again
                          </button>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="manual-entry"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24"
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={handleBackClick}
                    className="text-[#007AFF] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('common.back')}
                  </button>
                  <h2 className="text-lg font-semibold text-center text-[#1d1d1f] dark:text-white">
                    {editEntry ? t('mealAnalysis.headers.editMeal') : t('mealAnalysis.headers.manualEntry')}
                  </h2>
                  <div className="w-[32px]" />
                </div>

                <div className="space-y-2">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                    className="bg-gradient-to-br from-white/[0.05] to-transparent p-3 rounded-2xl border border-white/10"
                  >
                    <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white/90 mb-1">
                      {t('mealAnalysis.manual.mealType')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <motion.button
                          key={tag}
                          onClick={() => setSelectedTag(tag)}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-sm font-medium transition-all duration-300",
                            selectedTag === tag
                              ? "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                              : "bg-white/80 dark:bg-white/10 text-[#1d1d1f] dark:text-white/90 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.15]"
                          )}
                        >
                          {tag}
                        </motion.button>
                      ))}
                      {savedTags.map((tag) => (
                        <motion.button
                          key={tag}
                          onClick={() => setSelectedTag(tag)}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-sm font-medium transition-all duration-300",
                            selectedTag === tag
                              ? "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                              : "bg-white/80 dark:bg-white/10 text-[#1d1d1f] dark:text-white/90 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.15]"
                          )}
                        >
                          {tag}
                        </motion.button>
                      ))}
                      <motion.button
                        onClick={() => setSelectedTag("custom")}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-sm font-medium transition-all duration-300",
                          selectedTag === "custom"
                            ? "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                            : "bg-white/80 dark:bg-white/10 text-[#1d1d1f] dark:text-white/90 border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.15]"
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>
                    <AnimatePresence mode="wait">
                      {selectedTag === "custom" && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="flex gap-2 mt-2"
                        >
                          <motion.input
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            type="text"
                            placeholder={t('mealAnalysis.tags.customPlaceholder')}
                            value={customTag}
                            onChange={(e) => setCustomTag(e.target.value)}
                            className={`flex-1 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] text-[#1d1d1f] dark:text-white/90 transition-all duration-200 ${fontStyles.body}`}
                          />
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            onClick={handleSaveCustomTag}
                            disabled={!customTag}
                            className={cn(
                              "mt-1.5 px-3 py-1.5 rounded-lg ${fontStyles.button} transition-all duration-300",
                              "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              "hover:from-[#0066FF] hover:to-[#0044FF]",
                              "active:scale-[0.98]"
                            )}
                          >
                            {t('common.save')}
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                    className="bg-gradient-to-br from-white/[0.05] to-transparent p-3 rounded-2xl border border-white/10"
                  >
                    <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white/90 mb-1">
                      {t('mealAnalysis.manual.titleLabel')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('mealAnalysis.manual.titlePlaceholder')}
                      value={mealTitle}
                      onChange={(e) => setMealTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] text-[#1d1d1f] dark:text-white/90 transition-all duration-200"
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.45, delay: 0.3, ease: "easeOut" }}
                    className="bg-gradient-to-br from-white/[0.05] to-transparent p-3 rounded-2xl border border-white/10"
                  >
                    <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white/90 mb-1">
                      {t('mealAnalysis.manual.nutritionFacts')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: t('mealAnalysis.labels.calories'), value: calories, setter: setCalories, icon: "🔥" },
                        { label: `${t('mealAnalysis.labels.protein')} (${t('mealAnalysis.units.gramShort')})`, value: protein, setter: setProtein, icon: "💪" },
                        { label: `${t('mealAnalysis.labels.carbs')} (${t('mealAnalysis.units.gramShort')})`, value: carbs, setter: setCarbs, icon: "🌾" },
                        { label: `${t('mealAnalysis.labels.fat')} (${t('mealAnalysis.units.gramShort')})`, value: fat, setter: setFat, icon: "🥑" }
                      ].map((field, index) => (
                        <motion.div
                          key={field.label}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{
                            duration: 0.35,
                            delay: index * 0.08,
                            ease: "easeOut"
                          }}
                          className="relative"
                        >
                          <label className="block text-xs font-medium text-[#1d1d1f] dark:text-white/90 mb-0.5 flex items-center gap-1">
                            <span>{field.icon}</span>
                            {field.label}
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={field.value}
                            onChange={(e) => field.setter(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] text-[#1d1d1f] dark:text-white/90 transition-all duration-200"
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  className="fixed bottom-0 left-0 right-0 p-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] border-t border-black/5 dark:border-white/10 backdrop-blur-md z-50"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveMeal}
                      disabled={!isFormValid}
                      className={cn(
                        "flex-1 h-12 rounded-xl font-medium transition-all duration-300",
                        "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "hover:from-[#0066FF] hover:to-[#0044FF]",
                        "active:scale-[0.98]",
                        "shadow-lg shadow-blue-500/25",
                        !isFormValid && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isFormValid ? t('mealAnalysis.buttons.saveMeal') : t('mealAnalysis.buttons.fillAllFields')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {/** bottom-only white gradient overlay for popup container */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white" />
        </motion.div>
      </MealAnalysisAnimate>
      <ProSubscriptionPanel isOpen={isProPanelOpen} onClose={() => setIsProPanelOpen(false)} />
    </>
  );
};

export default MealAnalysis;