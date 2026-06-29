import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Timer, Brain, Dumbbell, ChevronDown, ChevronUp, X, Pause, Play, Activity, Lock, Utensils, Droplet, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { genAI } from "@/lib/gemini";
import { useNutritionStore } from "@/stores/nutritionStore";
import { useUserStore } from "@/stores/userStore";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import ProFeatures from "@/components/ProFeatures";
import ProSubscriptionPanel from "@/components/ProSubscriptionPanel";
import NavHide from "@/components/NavHide";
import { Link } from "react-router-dom";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

interface WorkoutSuggestion {
  name: string;
  type: string;
  duration: string;
  intensity: "Low" | "Medium" | "High";
  caloriesBurned: number;
  targetArea: string;
  equipment: string;
  instructions: string;
  minSets: number;
  caloriesPerMinute: number;
  tips: string[];
}

interface WorkoutTips {
  tips: string[];
  motivation: string;
}

interface TimerState {
  currentSet: number;
  totalSets: number;
  workTime: number;
  breakTime: number;
  isBreak: boolean;
  timeLeft: number;
  isRunning: boolean;
}

 

interface WorkoutAnalytics {
  totalDuration: number;
  totalCaloriesBurned: number;
  workoutsCompleted: number;
  lastWorkout: string;
}

const SPRING_CONFIG = {
  type: "spring",
  damping: 25,
  stiffness: 200,
};

const DEFAULT_WORKOUT_TIPS: Record<string, WorkoutTips> = {
  'High-Intensity Interval Training': {
    tips: [
      "Keep your form tight even when tired - quality over speed",
      "Breathe rhythmically: inhale on easy parts, exhale on exertion",
      "Start with shorter intervals if you're new to HIIT"
    ],
    motivation: "Push harder than yesterday if you want a different tomorrow"
  },
  'Strength Training': {
    tips: [
      "Focus on controlled movements and proper form",
      "Keep your core engaged throughout each exercise",
      "Don't forget to warm up your muscles first"
    ],
    motivation: "The only bad workout is the one that didn't happen"
  },
  'Cardio': {
    tips: [
      "Maintain a steady pace you can sustain",
      "Keep your shoulders relaxed and posture upright",
      "Stay hydrated throughout your session"
    ],
    motivation: "Every step forward is a step toward achieving your goals"
  }
};

const DEFAULT_TIPS: WorkoutTips = {
  tips: [
    "Start with a proper warm-up to prevent injury",
    "Focus on maintaining good form throughout",
    "Listen to your body and rest when needed"
  ],
  motivation: "Progress is progress, no matter how small"
};

// Simple array shuffle to add variability to lists
const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Build a compact signature for a workout to compare sets across refreshes
const workoutSignature = (w: WorkoutSuggestion): string => {
  return [
    (w.name || '').trim().toLowerCase(),
    (w.type || '').trim().toLowerCase(),
    (w.duration || '').trim().toLowerCase(),
    (w.intensity || '').toString().toLowerCase(),
    (w.targetArea || '').trim().toLowerCase(),
    (w.equipment || '').trim().toLowerCase(),
    (w.instructions || '').trim().toLowerCase()
  ].join('|');
};

const sameWorkoutSet = (a: WorkoutSuggestion[], b: WorkoutSuggestion[]): boolean => {
  if (!a || !b || a.length !== b.length) return false;
  const setA = new Set(a.map(workoutSignature));
  const setB = new Set(b.map(workoutSignature));
  if (setA.size !== setB.size) return false;
  for (const sig of setA) {
    if (!setB.has(sig)) return false;
  }
  return true;
};

// Hardcoded example workouts shown for non‑pro users
const getExampleWorkouts = (t: (k: string, opts?: any) => string): WorkoutSuggestion[] => {
  const min = t('units.min');
  return [
    {
      name: t('burn.examples.example1.name'),
      type: "Cardio",
      duration: `20 ${min}`,
      intensity: "Medium",
      caloriesBurned: 180,
      targetArea: t('burn.examples.example1.targetArea'),
      equipment: t('burn.examples.example1.equipment'),
      instructions: t('burn.examples.example1.instructions'),
      minSets: 3,
      caloriesPerMinute: 9,
      tips: [
        t('burn.examples.example1.tips.0'),
        t('burn.examples.example1.tips.1'),
        t('burn.examples.example1.tips.2'),
      ],
    },
    {
      name: t('burn.examples.example2.name'),
      type: "Cardio",
      duration: `12 ${min}`,
      intensity: "High",
      caloriesBurned: 150,
      targetArea: t('burn.examples.example2.targetArea'),
      equipment: t('burn.examples.example2.equipment'),
      instructions: t('burn.examples.example2.instructions'),
      minSets: 3,
      caloriesPerMinute: 12,
      tips: [
        t('burn.examples.example2.tips.0'),
        t('burn.examples.example2.tips.1'),
        t('burn.examples.example2.tips.2'),
      ],
    },
  ];
};

const loadFromStorage = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error loading ${key} from storage:`, error);
    return null;
  }
};

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
  }
};

export const Burn = () => {
  const [loading, setLoading] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => loadFromStorage('burn_isExpanded') || false);
  const [workouts, setWorkouts] = useState<WorkoutSuggestion[]>(() => loadFromStorage('burn_workouts') || []);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSuggestion | null>(null);
  const [workoutTips, setWorkoutTips] = useState<WorkoutTips | null>(() => loadFromStorage('burn_workoutTips') || null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const exceededNutrient = useNutritionStore((state) => state.exceededNutrient);
  const [timerState, setTimerState] = useState<TimerState>({
    currentSet: 1,
    totalSets: 3,
    workTime: 45,
    breakTime: 15,
    isBreak: false,
    timeLeft: 45,
    isRunning: false
  });
  
  const [workoutAnalytics, setWorkoutAnalytics] = useState<WorkoutAnalytics>(() => 
    loadFromStorage('workout_analytics') || {
      totalDuration: 0,
      totalCaloriesBurned: 0,
      workoutsCompleted: 0,
      lastWorkout: ''
    }
  );
  const { addBurnedCalories } = useNutritionStore();
  const { user } = useUserStore();
  const [actualCaloriesBurned, setActualCaloriesBurned] = useState<number>(0);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [isAddingWorkout, setIsAddingWorkout] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    saveToStorage('burn_workouts', workouts);
  }, [workouts]);

  useEffect(() => {
    saveToStorage('burn_isExpanded', isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    saveToStorage('burn_workoutTips', workoutTips);
  }, [workoutTips]);

  useEffect(() => {
    if (workouts.length === 0) {
      generateWorkouts({
        type: 'calories',
        amount: 0,
        goal: 0
      });
    }
  }, []);

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
    if (timerState.currentSet === timerState.totalSets && timerState.timeLeft === 0 && !timerState.isBreak) {
      updateWorkoutAnalytics();
    }
  }, [timerState]);

  // Keep track of the previously shown set to avoid repeats
  const previousWorkoutsRef = useRef<WorkoutSuggestion[]>(workouts);

  const generateWorkouts = async (retryCount = 0) => {
    setLoading(true);
    // Clear selection so first card can visually change immediately
    setSelectedWorkout(null);
    setWorkouts([]);
    
    // For non-pro users, only show example workouts - no AI generation
    if (!user?.isPro) {
      const examples = getExampleWorkouts(t);
      const shuffledExamples = shuffleArray(examples).slice(0, 3);
      setWorkouts(shuffledExamples);
      previousWorkoutsRef.current = shuffledExamples;
      saveToStorage('burn_workouts', shuffledExamples);
      setWorkoutTips({
        tips: [
          t('burn.tips.stayHydrated', 'Stay hydrated'),
          t('burn.tips.listenToBody', 'Listen to your body'),
          t('burn.tips.haveFun', 'Have fun')
        ],
        motivation: ''
      });
      setLoading(false);
      return;
    }
    
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const timestamp = Date.now();
      const randomSeed = Math.floor(Math.random() * 1000000);
      const responseLanguage = i18n.language?.startsWith('ar') ? 'Arabic' : 'English';
      
      const prompt = `Generate 3 cardio workouts with their tips.

      User Profile:
      - Age: ${user?.age} years
      - Gender: ${user?.gender}
      - Weight: ${user?.weight}kg
      - Height: ${user?.height}cm
      - BMR/Metabolism: ${user?.metabolism} calories/day
      - Experience Level: ${user?.experienceLevel || 'BEGINNER'}
      - Fitness Goals: ${user?.fitnessGoals || 'General Fitness'}
      - Activity Level: ${user?.activityLevel || 'Moderate'}
      - Health Conditions: ${user?.healthConditions || 'None'}
      - Preferred Time: ${user?.preferredTime || 'Any'}
      - Available Equipment: ${user?.equipment || 'None'}
      - Location: ${user?.location || 'Indoor'}
      - Weather: ${user?.weather || 'Any'}
      - Time Constraints: ${user?.timeConstraints || 'Flexible'}

      For each workout, provide:
      1. Unique cardio workout details
      2. Three specific form tips
      3. Estimated calories burned per minute for this specific user

      Language & Format Requirements:
      - Respond ONLY in ${responseLanguage} for all textual fields.
      - If ${responseLanguage} is Arabic, use clear Modern Standard Arabic suitable for Egypt; avoid transliteration; keep units natural (e.g., دقائق for minutes).
      - Return STRICT valid JSON.
      - Use EXACTLY the following keys in English as shown below; values should be localized to ${responseLanguage} when they are text.

      Randomness Control:
      - Use this seed strictly to introduce variety and avoid repeating previous answers: ${randomSeed}-${timestamp}
      - Do NOT reuse the same names or instructions you provided earlier.

      Return a JSON array with 3 objects:
      {
        "name": string,
        "type": string,
        "duration": string,
        "intensity": "Low" | "Medium" | "High",
        "caloriesPerMinute": number,
        "targetArea": string,
        "equipment": string,
        "instructions": string,
        "minSets": number,
        "tips": string[]
      }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const cleanJson = text.replace(/```json\n|\n```|```/g, '').trim();
      const workoutData = JSON.parse(cleanJson);
      
      const processedWorkouts = workoutData.map((data: any) => {
        const durationMinutes = parseInt(data.duration);
        const totalCalories = Math.round(data.caloriesPerMinute * durationMinutes);
        
        setWorkoutTips({
          tips: data.tips,
          motivation: ''
        });
        
        return {
          ...data,
          caloriesBurned: totalCalories
        };
      });
      
      // Shuffle to change visible order and especially the first card
      const shuffled = shuffleArray(processedWorkouts);
      
      // If same as previous set (ignoring order), retry a couple of times to ensure uniqueness
      if (sameWorkoutSet(shuffled, previousWorkoutsRef.current) && retryCount < 2) {
        await new Promise(r => setTimeout(r, 150)); // tiny delay to change seed/timestamp
        return generateWorkouts(retryCount + 1);
      }

      setWorkouts(shuffled);
      previousWorkoutsRef.current = shuffled;
      saveToStorage('burn_workouts', shuffled);
      if (workoutTips) {
        saveToStorage('burn_workoutTips', workoutTips);
      }
    } catch (error) {
      console.error('Error generating workouts:', error);
      // Fallback to example workouts so UI always shows something
      const examples = getExampleWorkouts(t);
      const shuffledExamples = shuffleArray(examples).slice(0, 3);
      setWorkouts(shuffledExamples);
      previousWorkoutsRef.current = shuffledExamples;
      saveToStorage('burn_workouts', shuffledExamples);
      setWorkoutTips({
        tips: [
          "Stay hydrated",
          "Listen to your body",
          "Have fun"
        ],
        motivation: ''
      });
      saveToStorage('burn_workoutTips', {
        tips: [
          "Stay hydrated",
          "Listen to your body",
          "Have fun"
        ],
        motivation: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const normalizeIntensity = (intensity: string) => {
    const value = (intensity || '').toString().toLowerCase();
    if (["low", "منخفض", "منخفضة", "خفيف", "خفيفة"].includes(value)) return 'low';
    if (["medium", "متوسط", "متوسطة"].includes(value)) return 'medium';
    if (["high", "مرتفع", "مرتفعة", "عالي", "عالية"].includes(value)) return 'high';
    return 'medium';
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'Low': return 'bg-green-500/10 text-green-500';
      case 'Medium': return 'bg-yellow-500/10 text-yellow-500';
      case 'High': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const renderWorkoutContent = (workout: WorkoutSuggestion, index: number) => (
    <motion.div 
      key={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      onClick={() => handleWorkoutClick(workout)}
      className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-5 cursor-pointer transform hover:-translate-y-0.5"
    >
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
        <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
      </div>
      <div className="relative flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <h2 className="text-[15px] font-medium text-gray-900 line-clamp-1">{workout.name}</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Badge 
            variant="secondary"
            className={cn(
              "flex items-center gap-1 text-xs",
              normalizeIntensity(workout.intensity) === 'low' && "bg-green-500/10 text-green-600",
              normalizeIntensity(workout.intensity) === 'medium' && "bg-yellow-500/10 text-yellow-600",
              normalizeIntensity(workout.intensity) === 'high' && "bg-red-500/10 text-red-600"
            )}
          >
            {t(`difficulty.${normalizeIntensity(workout.intensity)}`)}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
            <Timer className="h-3 w-3" />
            {workout.duration}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
            <Flame className="h-3 w-3 text-amber-500" />
            {workout === selectedWorkout && actualCaloriesBurned 
              ? actualCaloriesBurned 
              : `~${workout.caloriesBurned}`} cal
          </span>
        </div>
        

      </div>
    </motion.div>
  );

  const startTimer = (duration: string) => {
    const minutes = parseInt(duration.split(' ')[0]);
    setTimeLeft(minutes * 60);
    setIsTimerRunning(true);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerRunning && timeLeft !== null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetAllTimerState = () => {
    setTimerState({
      currentSet: 1,
      totalSets: 3,
      workTime: 45,
      breakTime: 15,
      isBreak: false,
      timeLeft: 45,
      isRunning: false
    });
  };

  const handleWorkoutClick = async (workout: WorkoutSuggestion) => {
    resetAllTimerState();
    setActualCaloriesBurned(0);
    setSelectedWorkout(workout);
  };

  const startWorkout = () => {
    if (!selectedWorkout) return;
    
    const workSeconds = parseInt(selectedWorkout.duration.split(' ')[0]) * 60;
    setTimerState(prev => ({
      ...prev,
      workTime: workSeconds / prev.totalSets,
      timeLeft: workSeconds / prev.totalSets,
      isRunning: true
    }));

    // Update last workout immediately
    setWorkoutAnalytics(prev => ({
      ...prev,
      lastWorkout: selectedWorkout.name
    }));
    saveToStorage('workout_analytics', workoutAnalytics);
  };

  const toggleTimer = () => {
    setTimerState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const resetTimer = () => {
    if (actualCaloriesBurned > 0) {
      addToTotalCalories(actualCaloriesBurned);
    }
    setActualCaloriesBurned(0);
    setTimerState(prev => ({
      ...prev,
      currentSet: 1,
      isBreak: false,
      timeLeft: prev.workTime,
      isRunning: false
    }));
  };

  const updateTimerSets = (sets: number) => {
    setTimerState(prev => ({
      ...prev,
      totalSets: sets,
      workTime: parseInt(selectedWorkout.duration.split(' ')[0]) * 60 / sets,
      timeLeft: parseInt(selectedWorkout.duration.split(' ')[0]) * 60 / sets,
    }));
  };

  const updateCalories = (duration: number, caloriesPerMinute: number) => {
    const totalCalories = Math.round(duration * caloriesPerMinute);
    setActualCaloriesBurned(prev => {
      const newTotal = totalCalories;
      // Add to total calories in circle immediately
      addToTotalCalories(newTotal - prev);
      return newTotal;
    });
  };

  const addToTotalCalories = (calories: number) => {
    if (calories <= 0) return;
    
    setWorkoutAnalytics(prev => {
      const updated = {
        ...prev,
        totalCaloriesBurned: prev.totalCaloriesBurned + calories
      };
      saveToStorage('workout_analytics', updated);
      return updated;
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (timerState.isRunning && timerState.timeLeft > 0) {
      interval = setInterval(() => {
        setTimerState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
        
        if (selectedWorkout) {
          // Calculate calories for current session only
          const sessionMinutes = (timerState.workTime - timerState.timeLeft) / 60;
          updateCalories(sessionMinutes, selectedWorkout.caloriesPerMinute);
        }
        
        setWorkoutAnalytics(prev => {
          const updated = {
            ...prev,
            totalDuration: prev.totalDuration + 1
          };
          saveToStorage('workout_analytics', updated);
          return updated;
        });
      }, 1000);
    } else if (timerState.timeLeft === 0 && !timerState.isBreak) {
      // When a set is completed
      if (timerState.currentSet < timerState.totalSets) {
        setTimerState(prev => ({
          ...prev,
          currentSet: prev.currentSet + 1,
          timeLeft: prev.workTime,
          isBreak: true
        }));
      } else {
        // Workout completed
        setWorkoutAnalytics(prev => ({
          ...prev,
          workoutsCompleted: prev.workoutsCompleted + 1,
          lastWorkout: selectedWorkout?.name || ''
        }));
        saveToStorage('workout_analytics', workoutAnalytics);
      }
    } else if (timerState.timeLeft === 0 && timerState.isBreak) {
      // Break finished, start next set
      setTimerState(prev => ({
        ...prev,
        timeLeft: prev.workTime,
        isBreak: false
      }));
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.isRunning, timerState.timeLeft, timerState.isBreak, selectedWorkout, timerState.currentSet, timerState.totalSets]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      setSelectedWorkout(null);
      setActualCaloriesBurned(0);
      resetAllTimerState();
    } else {
      y.set(0);
    }
    setIsDragging(false);
  };

  return (
    <div className="h-full">
      <div className="h-full overflow-y-auto -webkit-overflow-scrolling-touch">
        <div className="container mx-auto space-y-6 p-6 pb-24">
          <div className="flex flex-col gap-3">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-[1.75rem] tracking-tight text-black font-sf-display font-sf-bold"
            >
              {t('burn.ui.title')}
            </motion.h1>

            {user && (
              <div className="flex justify-center w-full -mt-1">
                <div className="bg-gray-100 rounded-full p-1 flex items-center shadow-md border border-gray-200/50">
                  <Link
                    to="/diet"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('nav.diet')}</span>
                    <Utensils className="w-4 h-4 text-gray-600" />
                  </Link>
                  <Link
                    to="/burn"
                    className="px-5 py-2 rounded-full bg-white shadow-sm flex items-center gap-2.5 transition-all duration-200 border border-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">{t('nav.burn')}</span>
                    <Flame className="w-4 h-4 text-primary" />
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

          {/* Calories Burned Circle */}
          <div className="bg-white backdrop-blur-xl border border-gray-200/20 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold text-gray-800 tracking-tight">{t('burn.stats.caloriesBurned')}</h3>
            </div>

            <div className="flex flex-col items-center">
              {/* Circular Progress */}
              <div className="relative w-48 h-48 mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    className="stroke-current text-gray-100"
                    strokeWidth="12"
                    fill="none"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    className="stroke-current text-primary"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - (workoutAnalytics.totalCaloriesBurned || 0) / 1000)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-gray-800">
                    {workoutAnalytics.totalCaloriesBurned || 0}
                  </span>
                  <span className="text-sm text-gray-600">{t('burn.stats.caloriesBurned')}</span>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <div className="bg-gray-50 backdrop-blur-sm rounded-3xl p-4 border border-gray-200">
                  <p className="text-gray-600 text-sm mb-1">{t('burn.stats.totalDuration')}</p>
                  <p className="text-2xl font-bold text-gray-800">{formatTime(workoutAnalytics?.totalDuration || 0)}</p>
                </div>
                <div className="bg-gray-50 backdrop-blur-sm rounded-3xl p-4 border border-gray-200">
                  <p className="text-gray-600 text-sm mb-1">{t('burn.stats.workoutsDone')}</p>
                  <p className="text-2xl font-bold text-gray-800">{workoutAnalytics?.workoutsCompleted || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Workout Suggestions */}
          <div className="space-y-[10px]">
            {/* Title Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="bg-white shadow-lg border border-black/5 rounded-full px-5 py-3">
                <span className="text-[15px] font-medium text-gray-800">{t('burn.ui.workoutSuggestions')}</span>
              </div>
              <ProFeatures>
                <button
                  onClick={() => !loading && generateWorkouts()}
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

            {/* Content Area (Pro/Non-Pro gated) */}
            <div className="space-y-2">
              <ProFeatures>
                {/* Pro user content */}
                {workouts.length === 0 && !loading ? (
                  <div className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-6 cursor-pointer">
                    <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
                      <div className="absolute inset-0 bg-gradient-conic-moving from-purple-500/10 via-pink-500/10 to-red-300/10" />
                    </div>
                    <div className="relative text-center">
                      <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-900 font-medium">{t('burn.ui.refreshTitle')}</p>
                      <p className="text-gray-600 text-sm mt-1">{t('burn.ui.refreshSubtitle')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workouts.map((workout, index) => (
                      <div key={index}>{renderWorkoutContent(workout, index)}</div>
                    ))}
                  </div>
                )}
              </ProFeatures>

              <ProFeatures showOnlyForNonPro>
                {/* Non‑pro user content (hardcoded examples) */}
                <div className="space-y-2">
                  {getExampleWorkouts(t).map((workout, index) => (
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
                        <h3 className="text-[15px] font-medium text-gray-900 line-clamp-1">{workout.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "flex items-center gap-1 text-xs",
                              workout.intensity === 'Low' && "bg-green-500/10 text-green-600",
                              workout.intensity === 'Medium' && "bg-yellow-500/10 text-yellow-600",
                              workout.intensity === 'High' && "bg-red-500/10 text-red-600"
                            )}
                          >
                            {t(`difficulty.${workout.intensity.toLowerCase()}`)}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1 text-xs text-gray-600 border-gray-200">
                            <Timer className="h-3 w-3" />
                            {workout.duration}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                            <Flame className="h-3 w-3 text-amber-500" />
                            ~{workout.caloriesBurned} cal
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <motion.div 
                    onClick={() => setIsProPanelOpen(true)}
                    className="group relative bg-gradient-to-r from-white via-white to-transparent backdrop-blur-sm border border-black/5 rounded-3xl overflow-hidden hover:border-black/10 transition-all duration-200 shadow-lg p-5 cursor-pointer transform hover:-translate-y-0.5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: getExampleWorkouts(t).length * 0.1 }}
                  >
                    <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-white/5">
                      <div className="absolute inset-0 bg-gradient-conic-moving from-blue-500/10 via-purple-500/10 to-pink-300/10" />
                    </div>
                    <div className="relative flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" />
                      <p className="text-gray-900 text-sm font-medium">{t('burn.ui.subscribeCta')}</p>
                    </div>
                  </motion.div>
                </div>
              </ProFeatures>
            </div>
          </div>
        </div>
      </div>

        {/* Workout Details Popup */
        }
        {/* Keep NavHide in app tree to avoid portal stacking issues */}
        <NavHide isAIOpen={!!selectedWorkout} />
        {createPortal(
          (
            <AnimatePresence>
              {selectedWorkout && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
                    onClick={() => {
                      setSelectedWorkout(null);
                      resetAllTimerState();
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
                        "flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-8",
                        isDragging && "pointer-events-none"
                      )}>
                    {/* Timer Section */}
                    <div className="relative mb-12">
                      <div className="relative text-center">
                        {/* Timer Circle with Click Handler */}
                        <motion.div 
                          className="relative w-48 h-48 mx-auto cursor-pointer group"
                          onClick={toggleTimer}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Background Circle */}
                          <div className="absolute inset-0 rounded-full border-2 border-[#1a1a1a]" />
                          
                          {/* Progress Circle */}
                          <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                            <circle
                              cx="96"
                              cy="96"
                              r="88"
                              fill="none"
                              stroke="#0066FF"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 88}`}
                              strokeDashoffset={`${2 * Math.PI * 88 * (1 - timerState.timeLeft / (timerState.isBreak ? timerState.breakTime : timerState.workTime))}`}
                              className="transition-all duration-300"
                            />
                          </svg>
                          
                          {/* Center Content */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[2.5rem] font-medium text-gray-900">
                              {formatTime(timerState.timeLeft)}
                            </span>
                            <div className="text-sm text-gray-600 space-y-0.5">
                              <div>{t('burn.timer.set', { current: timerState.currentSet, total: timerState.totalSets })}</div>
                              <div>{t(timerState.isBreak ? 'burn.timer.break' : 'burn.timer.work')}</div>
                            </div>
                          </div>

                          {/* Timer Caption */}
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap">
                            {t(timerState.isRunning ? 'burn.popup.tapToPause' : 'burn.popup.tapToStart')}
                          </div>
                        </motion.div>

                        {/* Vertical Controls */}
                        <div className="absolute top-1/2 right-2 -translate-y-1/2 flex flex-col gap-4">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={resetTimer}
                            className="w-[48px] h-[48px] rounded-full bg-[#1a1a1a] hover:bg-[#252525] transition-colors flex items-center justify-center relative group"
                          >
                            <div className="absolute inset-0 rounded-full bg-white/5 blur opacity-0 group-hover:opacity-100 transition-opacity" />
                            <RefreshCw className="h-5 w-5 text-white/80" />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const newSets = timerState.totalSets === 5 ? 1 : timerState.totalSets + 1;
                              updateTimerSets(newSets);
                            }}
                            className="flex items-center px-5 py-2.5 rounded-full bg-[#1a1a1a] hover:bg-[#252525] transition-colors"
                          >
                            <span className="text-white text-base">{timerState.totalSets}</span>
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Workout Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mt-8">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative col-span-2 group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-6 rounded-xl bg-gradient-to-br from-primary/[0.15] to-transparent border border-primary/20 backdrop-blur-md">
                          <div className="text-sm text-gray-600 mb-2">{t('burn.popup.caloriesWillBeBurned')}</div>
                          <div className="flex items-baseline gap-2">
                            <div className="font-medium text-2xl text-gray-900">
                              {actualCaloriesBurned || '~' + selectedWorkout.caloriesBurned}
                            </div>
                            <div className="text-sm text-gray-600">
                              {t(actualCaloriesBurned ? 'burn.popup.actual' : 'burn.popup.estimated')}
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {[
                        { key: 'intensity', label: t('burn.labels.intensity'), value: t(`difficulty.${normalizeIntensity(selectedWorkout.intensity)}`) },
                        { key: 'targetArea', label: t('burn.labels.targetArea'), value: selectedWorkout.targetArea },
                        { key: 'equipment', label: t('burn.labels.equipment'), value: selectedWorkout.equipment },
                        { key: 'minSets', label: t('burn.labels.minSets'), value: selectedWorkout.minSets ? selectedWorkout.minSets.toString() : '3' }
                      ].map((stat, index) => (
                        stat.key === 'minSets' ? (
                          <div key={stat.key} className="relative">
                            <div className="relative p-4 rounded-xl bg-white border border-gray-200">
                              <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
                              <div className="font-medium text-gray-900">{stat.value}</div>
                            </div>
                          </div>
                        ) : (
                          <motion.div
                            key={stat.key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative group"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative p-4 rounded-xl bg-gradient-to-br from-white/[0.08] to-transparent border border-white/[0.08] backdrop-blur-md">
                              <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
                              <div className="font-medium text-gray-900">{stat.value}</div>
                            </div>
                          </motion.div>
                        )
                      ))}
                    </div>

                    {/* Instructions Section */}
                    <div className="relative space-y-3">
                      <h3 className="text-lg font-medium text-gray-900">{t('burn.sections.instructions')}</h3>
                      <div className="relative p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
                        <p className="relative text-gray-800 leading-relaxed">
                          {selectedWorkout.instructions}
                        </p>
                      </div>
                    </div>

                    {/* Pro Tips Section */}
                    {workoutTips && (
                      <div className="relative space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">{t('burn.sections.proTips')}</h3>
                        <ul className="space-y-3">
                          {workoutTips.tips.map((tip, index) => (
                            <motion.li
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="relative flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-sm group"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                              <div className="relative mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                              <p className="relative text-gray-800">{tip}</p>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          ),
          document.body
        )}
        <ProSubscriptionPanel isOpen={isProPanelOpen} onClose={() => setIsProPanelOpen(false)} />
    </div>
  );
};

export default Burn; 