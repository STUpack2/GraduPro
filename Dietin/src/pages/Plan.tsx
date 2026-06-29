import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion';
import { useUserStore } from '@/stores/userStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useProgressStore } from '@/stores/progressStore';
import { AICoachPanel } from '@/features/ai-coach/AICoachPanel';
import { isAiConfigured } from '@/lib/aiCoachApi';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronRight, X, Loader2,
  ArrowLeft, RefreshCw, Info, Heart, HeartOff,
  Play, Plus, Minus, Check, Activity, Edit2, RotateCcw, ChevronDown, AlertTriangle, Dumbbell, ClipboardList, Moon, Wind, Bed, Droplets, Apple, Brain, Search, ArrowDown, Timer, BarChart3, ChevronLeft, FiPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import ProFeatures from '@/components/ProFeatures';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import NavHide from '@/components/NavHide';
import { UserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from "@/components/ui/use-toast"

// Import images
import chestImg from '@/assets/Gemini_Generated_Image_evad8nevad8nevad.jpeg';
import backImg from '@/assets/Gemini_Generated_Image_itl7amitl7amitl7.jpeg';
import legsImg from '@/assets/Gemini_Generated_Image_jl29dyjl29dyjl29.jpeg';
import shouldersImg from '@/assets/Gemini_Generated_Image_oxizy9oxizy9oxiz.jpeg';
import armsImg from '@/assets/Gemini_Generated_Image_s935pps935pps935.jpeg';
import coreImg from '@/assets/Gemini_Generated_Image_y3hqp7y3hqp7y3hq.jpeg';
import cardioImg from '@/assets/cardio.jpeg';

// Temporarily use existing images
const upperBodyImg = chestImg;
const lowerBodyImg = legsImg;
const fullBodyImg = shouldersImg;

// Import exercises data
import exerciseData from '@/data/exercises.json';

// Add Gemini AI import and initialization
import { GoogleGenerativeAI } from "@google/generative-ai";
import { genAI } from "@/lib/gemini";

interface Exercise {
  id: string;
  name: string;
  force?: string;
  level: string;
  mechanic?: string;
  equipment?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
  isFavorite?: boolean;
}

interface WorkoutDay {
  day: number;
  focus: string;
  exercises: Exercise[];
}

interface MuscleGroup {
  id: string;
  name: string;
  color: string;
  image: string;
  primaryMuscles: string[];
  workoutDays: WorkoutDay[];
}

interface WorkoutSet {
  id: string;
  reps: number;
  weight: number;
  isCompleted: boolean;
  restTime: number;
  isResting: boolean;
}

interface ExerciseProgress {
  exercise: Exercise;
  sets: WorkoutSet[];
  isExpanded: boolean;
  isCompleted: boolean;
  weightUnit: 'kg' | 'lb';  // Add this line
}

// Add new interfaces for progress tracking
interface ExerciseHistory {
  exerciseId: string;
  name: string;
  lastReps: number;
  lastWeight: number;
  lastRestTime: number;
  date: string;
  weightUnit: 'kg' | 'lb'; // Add this line
}

interface WorkoutHistory {
  date: string;
  muscleGroup: string;
  exercises: {
    name: string;
    musclesWorked: string[];
    setsCompleted: number;
    totalSets: number;
    reps: number;
    weight: number;
    restTime: number;
    rpm?: number;
    volume?: number;
  }[];
  completionPercentage: number;
}

interface CustomPlanDay {
  id: string;
  name: string;
  focus: string;
  exercises: Exercise[];
}

interface CustomPlan {
  id: string;
  name: string;
  days: CustomPlanDay[];
  createdAt: string;
}

interface PlanProps {
  userProfile: UserProfile;
  analysisResult?: {
    goal: string;
    calories: number;
    metabolism: number;
    protein: number;
    carbs: number;
    fat: number;
    estimatedWeeks: number;
  };
}

const BASE_IMAGE_URL = '/exercises/';

const Plan = () => {
  const { t, i18n } = useTranslation();
  // Determine if current language direction is RTL (e.g., Arabic)
  const isRTL = i18n.dir() === 'rtl';
  const { user } = useUserStore();
  const { favorites, addFavorite, removeFavorite } = useWorkoutStore();
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isWorkoutStarted, setIsWorkoutStarted] = useState(false);
  const [workoutProgress, setWorkoutProgress] = useState<ExerciseProgress[]>([]);
  // AI Coach toggle per active exercise. Keyed by exercise index. When true,
  // the AICoachPanel renders below the exercise card and bubbles rep counts
  // into the active set's reps field via setWorkoutProgress.
  const [aiCoachByExercise, setAICoachByExercise] = useState<Record<number, boolean>>({});
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [currentRestTimer, setCurrentRestTimer] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory[]>(() => {
    const saved = localStorage.getItem('workoutHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistory[]>(() => {
    const saved = localStorage.getItem('exerciseHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showProgressModal, setShowProgressModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Custom Plan States
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>(() => {
    const saved = localStorage.getItem('customPlans');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCustomPlanModal, setShowCustomPlanModal] = useState(false);
  const [customPlanStep, setCustomPlanStep] = useState<'name' | 'days' | 'exercises'>('name');
  const [newCustomPlan, setNewCustomPlan] = useState<CustomPlan>({
    id: '',
    name: '',
    days: [],
    createdAt: ''
  });
  const [selectedCustomPlan, setSelectedCustomPlan] = useState<CustomPlan | null>(null);
  const [selectedCustomDay, setSelectedCustomDay] = useState<CustomPlanDay | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForceType, setSelectedForceType] = useState<
    'all' | 'pull' | 'push' | 'static' | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'
  >('all');

  // Add this state for exercise search and filtering
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  const [workoutInsights, setWorkoutInsights] = useState("");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Add state for tracking workout metrics
  const [workoutMetrics, setWorkoutMetrics] = useState({
    totalVolume: 0,
    completedSets: 0,
    averageSetTime: 0,
    averageRestTime: 0,
    rpm: 0,
    totalWorkoutTime: 0,
    setTimes: [] as number[]
  });

  // Add new state for tracking if any sets were completed
  const [hasCompletedAnySets, setHasCompletedAnySets] = useState(false);

  // Add state for tracking set completion times
  const [lastSetCompletionTime, setLastSetCompletionTime] = useState<number | null>(null);

  // Add these state variables near the top with other state declarations
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);

  const { toast } = useToast()

  const [isFloatingTimer, setIsFloatingTimer] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: 0, y: 0 });
  const floatingTimerRef = useRef<HTMLDivElement | null>(null);

  const startFloatingTimer = () => {
    setIsFloatingTimer(true);
    // Position at bottom right initially
    setTimerPosition({
      x: window.innerWidth - 120,
      y: window.innerHeight - 120
    });
  };

  const stopFloatingTimer = () => {
    setIsFloatingTimer(false);
  };

  // Handle floating timer drag
  const handleFloatingTimerDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = Math.min(Math.max(0, info.point.x), window.innerWidth - 100);
    const newY = Math.min(Math.max(0, info.point.y), window.innerHeight - 100);
    setTimerPosition({ x: newX, y: newY });
  };

  // Stop floating timer when rest ends
  useEffect(() => {
    if (!currentRestTimer) {
      stopFloatingTimer();
    }
  }, [currentRestTimer]);

  // Handle visibility change for mobile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && currentRestTimer && !isFloatingTimer) {
        startFloatingTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentRestTimer, isFloatingTimer]);

  
  

  // Add this effect near the top of the Plan component, with other useEffects
  useEffect(() => {
    const shouldOpenCustomPlan = localStorage.getItem('shouldOpenCustomPlan');
    if (shouldOpenCustomPlan === 'true') {
      localStorage.removeItem('shouldOpenCustomPlan');
      setTimeout(() => {
        setShowCustomPlanModal(true);
      }, 100);
    }
  }, []);

  // Favorites are persisted locally via Zustand's persist middleware.
  // No Firestore sync is implemented, so no loading effect is needed here.

  const handleDragStart = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX - dragOffset);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newOffset = e.clientX - dragStart;
    const containerWidth = imageContainerRef.current?.offsetWidth || 0;
    const limitedOffset = Math.max(Math.min(newOffset, containerWidth / 2), -containerWidth / 2);
    setDragOffset(limitedOffset);
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = (imageContainerRef.current?.offsetWidth || 0) * 0.2;
    if (Math.abs(dragOffset) > threshold) {
      const newIndex = dragOffset > 0 ? 0 : 1;
      setCurrentImageIndex(newIndex);
    }
    setDragOffset(0);
  };

  const switchImage = (e: React.MouseEvent, direction: 'next' | 'prev') => {
    e.stopPropagation();
    const newIndex = direction === 'next' ? 1 : 0;
    setCurrentImageIndex(newIndex);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (selectedImage !== null) {
      if (e.key === 'ArrowRight') {
        setCurrentImageIndex(currentImageIndex === 0 ? 1 : 0);
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex(currentImageIndex === 0 ? 1 : 0);
      } else if (e.key === 'Escape') {
        setSelectedImage(null);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentImageIndex, selectedImage]);

  // Update exercise loading
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setIsLoading(true);
        
        // Load exercises from the public directory
        const response = await fetch('/exercises.json');
        if (!response.ok) throw new Error(`Failed to fetch /exercises.json: ${response.status}`);
        const data = await response.json();
        
        // Map the exercise data to include image paths
        const mappedExercises = data.map((exercise: any) => ({
          ...exercise,
          id: exercise.name.replace(/\s+/g, '_'),
          images: [
            `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/0.jpg`,
            `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/1.jpg`
          ]
        }));

        console.log(`Loaded ${mappedExercises.length} exercises`);
        setAllExercises(mappedExercises);
        setFilteredExercises(mappedExercises);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading exercises:', error);
        // Fallback to bundled data import
        try {
          const mappedExercises = (exerciseData as any[]).map((exercise: any) => ({
            ...exercise,
            id: exercise.name.replace(/\s+/g, '_'),
            images: [
              `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/0.jpg`,
              `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/1.jpg`
            ]
          }));
          console.log(`Loaded ${mappedExercises.length} exercises from local import fallback`);
          setAllExercises(mappedExercises);
          setFilteredExercises(mappedExercises);
        } catch (e) {
          console.error('Failed to load fallback exercise data:', e);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadExercises();
  }, []);

  // Update filterExercises function
  const filterExercises = (muscleGroup: MuscleGroup) => {
    setIsLoading(true);
    const normalize = (s: string) => s.toLowerCase().replace(/_/g, ' ');
    const muscleKeyToName = (key: string) => normalize(key.split('.')?.pop() || key);
    const groupMuscles = muscleGroup.primaryMuscles.map(muscleKeyToName);
    const filtered = allExercises.filter(exercise =>
      exercise.primaryMuscles.some(muscle => groupMuscles.includes(normalize(muscle)))
    );
    setExercises(filtered);
    setIsLoading(false);
  };

  const toggleFavorite = (exercise: Exercise) => {
    const isFavorite = favorites.some(fav => fav.id === exercise.id);
    if (isFavorite) {
      removeFavorite(exercise.id);
    } else {
      addFavorite(exercise);
    }
  };

  const handleMuscleSelect = (muscleId: string) => {
    if (muscleId === 'favorites') {
      setSelectedMuscle(muscleId);
      setExercises(favorites);
      setIsLoading(false);
    } else {
      const selectedGroup = muscleGroups.find(m => m.id === muscleId);
      if (selectedGroup) {
        setSelectedMuscle(muscleId);
        filterExercises(selectedGroup);
      }
    }
  };

  useEffect(() => {
    if (showExerciseModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }, [showExerciseModal]);

  const selectExercisesForDay = (muscleGroup: MuscleGroup, day: number) => {
    const workoutDay = muscleGroup.workoutDays[day - 1];
    
    // Return empty array for rest days
    if (isRestDay(workoutDay.focus)) {
      return [];
    }

    let targetMuscles: string[] = [];
    
    switch (muscleGroup.id) {
      case 'push_pull':
        switch (workoutDay.focus) {
          case t('plan.push_day'):
            targetMuscles = ['chest', 'shoulders', 'triceps'];
            break;
          case t('plan.pull_day'):
            targetMuscles = ['back', 'biceps', 'traps'];
            break;
          case t('plan.full_body'):
            targetMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'calves'];
            break;
        }
        break;
        
      case 'bro_split':
        switch (workoutDay.focus) {
          case t('plan.chest_day'):
            targetMuscles = ['chest'];
            break;
          case t('plan.back_day'):
            targetMuscles = ['back', 'traps'];
            break;
          case t('plan.shoulder_day'):
            targetMuscles = ['shoulders'];
            break;
          case t('plan.arm_day'):
            targetMuscles = ['biceps', 'triceps'];
            break;
          case t('plan.leg_day'):
            targetMuscles = ['quadriceps', 'hamstrings', 'calves', 'glutes'];
            break;
          case t('plan.core_cardio'):
            targetMuscles = ['abdominals', 'lower back'];
            break;
        }
        break;

      case 'upper_lower':
        switch (workoutDay.focus) {
          case t('plan.upper_body'):
            targetMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
            break;
          case t('plan.lower_body'):
            targetMuscles = ['quadriceps', 'hamstrings', 'calves', 'glutes'];
            break;
        }
        break;
    }

    // Helpers to normalize muscle keys (e.g., 'muscles.sub_muscles.lower_back' → 'lower back')
    const normalize = (s: string) => s.toLowerCase().replace(/_/g, ' ');
    const muscleKeyToName = (key: string) => normalize(key.split('.')?.pop() || key);

    const normalizedTargetMuscles = targetMuscles.map(normalize);

    // Filter exercises based on normalized target muscles
    const filtered = allExercises.filter(exercise =>
      exercise.primaryMuscles.some(muscle => 
        normalizedTargetMuscles.includes(muscleKeyToName(muscle))
      )
    );

    // Return up to 6 exercises
    return filtered.slice(0, 6);
  };

  // Add this function to handle progression
  const handleProgression = () => {
    if (!workoutProgress.length) return;

    const currentExercise = workoutProgress[currentExerciseIndex];
    if (!currentExercise) return;

    // Check if this is the last set of the last exercise
    const isLastSet = currentSetIndex === currentExercise.sets.length - 1;
    const isLastExercise = currentExerciseIndex === workoutProgress.length - 1;

    // Complete current set
    handleSetComplete(currentExerciseIndex, currentSetIndex);

    if (isLastSet && isLastExercise) {
      // If all sets and exercises are complete, end the workout
      endWorkout();
      return;
    }

    // Calculate next position
    if (currentSetIndex < currentExercise.sets.length - 1) {
      // Move to next set in current exercise
      setCurrentSetIndex(prev => prev + 1);
    } else if (currentExerciseIndex < workoutProgress.length - 1) {
      // Move to first set of next exercise
      setCurrentExerciseIndex(prev => prev + 1);
      setCurrentSetIndex(0);
      // Expand next exercise
      setWorkoutProgress(prev => {
        const newProgress = [...prev];
        if (newProgress[currentExerciseIndex + 1]) {
          newProgress[currentExerciseIndex + 1].isExpanded = true;
        }
        return newProgress;
      });
    }
  };

  // Update startWorkout function to initialize indices
  const startWorkout = () => {
    const initialProgress = exercises.map((exercise, index) => {
      const lastExercise = exerciseHistory.find(h => h.exerciseId === exercise.id);
      return {
        exercise,
        sets: [
          { 
            id: '1', 
            reps: lastExercise?.lastReps || 12, 
            weight: lastExercise?.lastWeight || 20, 
            isCompleted: false, 
            restTime: lastExercise?.lastRestTime || 90, 
            isResting: false 
          },
          { 
            id: '2', 
            reps: lastExercise?.lastReps || 12, 
            weight: lastExercise?.lastWeight || 20, 
            isCompleted: false, 
            restTime: lastExercise?.lastRestTime || 90, 
            isResting: false 
          },
          { 
            id: '3', 
            reps: lastExercise?.lastReps || 12, 
            weight: lastExercise?.lastWeight || 20, 
            isCompleted: false, 
            restTime: lastExercise?.lastRestTime || 90, 
            isResting: false 
          }
        ],
        isExpanded: index === 0,
        isCompleted: false,
        weightUnit: 'kg' as const // Explicitly type as 'kg' | 'lb'
      };
    });
    setWorkoutProgress(initialProgress);
    setIsWorkoutStarted(true);
    setActiveExerciseIndex(0);
    setActiveSetIndex(0);
    // Reset and start tracking workout time
    setWorkoutMetrics(prev => ({
      ...prev,
      totalWorkoutTime: 0
    }));
    setCurrentExerciseIndex(0);
    setCurrentSetIndex(0);
  };

  // Add workout timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isWorkoutStarted) {
      interval = setInterval(() => {
        setWorkoutMetrics(prev => ({
          ...prev,
          totalWorkoutTime: prev.totalWorkoutTime + 1
        }));
      }, 1000);
    } else {
      // Reset timer when workout ends
      setWorkoutMetrics(prev => ({
        ...prev,
        totalWorkoutTime: prev.totalWorkoutTime // Preserve the final time
      }));
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWorkoutStarted]);

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      const exercise = newProgress[exerciseIndex];
      const set = exercise.sets[setIndex];
      
      // Toggle completion status
      set.isCompleted = !set.isCompleted;
      
      // Update exercise completion status
      exercise.isCompleted = exercise.sets.every(s => s.isCompleted);

      // Update hasCompletedAnySets if any set is completed
      const anyCompletedSets = newProgress.some(ex => 
        ex.sets.some(s => s.isCompleted)
        );
        setHasCompletedAnySets(anyCompletedSets);

      return newProgress;
    });

    const currentSet = workoutProgress[exerciseIndex].sets[setIndex];
    if (currentSet.isCompleted) {
      // Start rest timer automatically
      startRest(currentSet.restTime, exerciseIndex, setIndex);
    }
  };

  const startRest = (restTime: number, exerciseIndex: number, setIndex: number) => {
    setCurrentRestTimer(restTime);
    setIsResting(true);
    
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      // Add safety checks
      if (!newProgress[exerciseIndex] || !newProgress[exerciseIndex].sets[setIndex]) {
        return prev;
      }
      
      newProgress[exerciseIndex].sets[setIndex].isResting = true;
      return newProgress;
    });
    
    const timerRef = setInterval(() => {
      setCurrentRestTimer(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(timerRef);
          setIsResting(false);
          progressToNextSet(exerciseIndex, setIndex);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const progressToNextSet = (exerciseIndex: number, setIndex: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      // Add safety checks
      if (!newProgress[exerciseIndex] || !newProgress[exerciseIndex].sets[setIndex]) {
        return prev;
      }
      
      newProgress[exerciseIndex].sets[setIndex].isResting = false;
      
      // Check if there are more sets in current exercise
      if (setIndex < newProgress[exerciseIndex].sets.length - 1) {
        setActiveSetIndex(setIndex + 1);
      } else {
        // Mark exercise as completed
        newProgress[exerciseIndex].isCompleted = true;
        
        // Move to next exercise if available
        if (exerciseIndex < newProgress.length - 1) {
          setActiveExerciseIndex(exerciseIndex + 1);
          setActiveSetIndex(0);
          // Expand next exercise
          newProgress[exerciseIndex].isExpanded = false;
          newProgress[exerciseIndex + 1].isExpanded = true;
        } else {
          // Workout completed
          setShowCompletionModal(true);
        }
      }
      
      return newProgress;
    });
  };

  const addSet = (exerciseIndex: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      const newSet = {
        id: (newProgress[exerciseIndex].sets.length + 1).toString(),
        reps: 12,
        weight: newProgress[exerciseIndex].sets[newProgress[exerciseIndex].sets.length - 1]?.weight || 0,
        isCompleted: false,
        restTime: 90,
        isResting: false
      };
      newProgress[exerciseIndex].sets.push(newSet);
      return newProgress;
    });
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      newProgress[exerciseIndex].sets.splice(setIndex, 1);
      return newProgress;
    });
  };

  const updateSetValue = (
    exerciseIndex: number, 
    setIndex: number, 
    field: 'reps' | 'weight' | 'restTime',
    value: number | null
  ) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      if (newProgress[exerciseIndex] && newProgress[exerciseIndex].sets[setIndex]) {
        newProgress[exerciseIndex].sets[setIndex][field] = value || 0;
      }
      return newProgress;
    });
  };

  const skipRest = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCurrentRestTimer(null);
    setIsResting(false);
    progressToNextSet(activeExerciseIndex, activeSetIndex);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Add new function to update all sets for an exercise
  const updateAllSetsForExercise = (exerciseIndex: number, field: 'reps' | 'weight', value: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      newProgress[exerciseIndex].sets.forEach(set => {
        set[field] = value;
      });
      return newProgress;
    });
  };

  // Add new function to update rest time for all sets
  const updateAllRestTimes = (value: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      newProgress.forEach(exercise => {
        exercise.sets.forEach(set => {
          set.restTime = value;
        });
      });
      return newProgress;
    });
  };

  // Add new function to apply value to all sets in all exercises
  const applyValueToAllSets = (field: 'reps' | 'weight' | 'restTime', value: number) => {
    if (value === 0) return;
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      newProgress.forEach(exercise => {
        exercise.sets.forEach(set => {
          set[field] = value;
        });
      });
      return newProgress;
    });
  };

  // Update the handleSetComplete function to track set times
  const handleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const setStartTime = Date.now();
    
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      const exercise = newProgress[exerciseIndex];
      const set = exercise.sets[setIndex];
      
      // Mark set as completed
      set.isCompleted = true;
      
      // Update exercise completion status
      exercise.isCompleted = exercise.sets.every(s => s.isCompleted);
      
      // Update hasCompletedAnySets
      setHasCompletedAnySets(true);
      
      return newProgress;
    });

    // Record set completion time
      setWorkoutMetrics(prev => ({
        ...prev,
      setTimes: [...prev.setTimes, Date.now() - setStartTime]
    }));

    // Check if this is the last set of the last exercise
    const isLastSet = setIndex === workoutProgress[exerciseIndex].sets.length - 1;
    const isLastExercise = exerciseIndex === workoutProgress.length - 1;

    // Only start rest timer if it's not the final set of the workout
    if (!isLastSet || !isLastExercise) {
      const set = workoutProgress[exerciseIndex].sets[setIndex];
      if (set.restTime) {
        startRest(set.restTime, exerciseIndex, setIndex);
      }
    }
  };

  // Update the endWorkout function to calculate final metrics
  const endWorkout = async () => {
    // Stop the workout timer
    setIsWorkoutStarted(false);
    
    // Check if any sets were completed
    const hasAnyCompletedSets = workoutProgress.some(exercise => 
      exercise.sets.some(set => set.isCompleted)
    );

    // Force update hasCompletedAnySets state to ensure it's correct
    setHasCompletedAnySets(hasAnyCompletedSets);

    if (!hasAnyCompletedSets) {
      // Show the "See you later" modal for incomplete workouts
      setShowCompletionModal(true);
      setWorkoutProgress([]);
      return;
    }

    setIsLoadingInsights(true);
    
    // Calculate final metrics
    const completedSets = workoutProgress.reduce((acc, curr) => 
      acc + curr.sets.filter(set => set.isCompleted).length, 0
    );

    const totalVolume = workoutProgress.reduce((acc, curr) => {
      const conversionFactor = curr.weightUnit === 'lb' ? 0.453592 : 1; // Convert to kg for storage
      return acc + curr.sets.reduce((setAcc, set) => 
        setAcc + (set.isCompleted ? set.reps * set.weight * conversionFactor : 0), 0
      );
    }, 0);

    // Calculate average set time from recorded set times
    const averageSetTime = workoutMetrics.setTimes.length > 0 
      ? Math.round(workoutMetrics.setTimes.reduce((a, b) => a + b, 0) / workoutMetrics.setTimes.length / 1000)
      : 0;

    // Calculate average rest time
    const averageRestTime = workoutProgress.reduce((acc, curr) => {
      const exerciseRestTime = curr.sets.reduce((setAcc, set) => 
        setAcc + (set.isCompleted ? set.restTime : 0), 0);
      return acc + exerciseRestTime;
    }, 0) / completedSets;

    // Calculate RPM (Reps Per Minute) for completed sets
    const totalRPM = workoutProgress.reduce((acc, curr) => {
      const exerciseRPM = curr.sets.reduce((setAcc, set) => {
        if (!set.isCompleted) return setAcc;
        const conversionFactor = curr.weightUnit === 'lb' ? 0.453592 : 1;
        const setVolume = set.reps * set.weight * conversionFactor;
        const setTimeInMinutes = (set.restTime || 60) / 60;
        return setAcc + (setVolume / setTimeInMinutes);
      }, 0);
      return acc + exerciseRPM;
    }, 0);

    const rpm = completedSets > 0 ? Math.round(totalRPM / completedSets) : 0;

    setWorkoutMetrics(prev => ({
      ...prev,
      totalVolume: Math.round(totalVolume * 100) / 100,
      completedSets,
      averageSetTime,
      averageRestTime,
      rpm,
      totalWorkoutTime: prev.totalWorkoutTime // Preserve the total workout time
    }));
    
    // Save workout history with proper weight unit handling
    const currentDate = new Date().toISOString();
    const currentMuscleGroup = selectedMuscle === 'custom' 
      ? selectedCustomPlan?.name || 'Custom Plan'
      : muscleGroups.find(m => m.id === selectedMuscle)?.name || '';

    const workoutHistoryEntry: WorkoutHistory = {
      date: currentDate,
      muscleGroup: currentMuscleGroup,
      exercises: workoutProgress.map(exercise => {
        // Convert weights to kg for storage if needed
        const conversionFactor = exercise.weightUnit === 'lb' ? 0.453592 : 1;
        const avgWeight = exercise.sets.reduce((sum, set) => sum + set.weight, 0) / exercise.sets.length;
        
        return {
        name: exercise.exercise.name,
        musclesWorked: exercise.exercise.primaryMuscles,
        setsCompleted: exercise.sets.filter(set => set.isCompleted).length,
        totalSets: exercise.sets.length,
        reps: exercise.sets[0]?.reps || 0,
          weight: Math.round(avgWeight * conversionFactor * 100) / 100,
        restTime: exercise.sets[0]?.restTime || 0,
        rpm: Math.round(exercise.sets.reduce((acc, set) => 
            acc + (set.isCompleted ? (set.reps * set.weight * conversionFactor) / (set.restTime || 60) * 60 : 0
        ), 0) / exercise.sets.filter(set => set.isCompleted).length),
          volume: Math.round(exercise.sets.reduce((acc, set) => 
            acc + (set.isCompleted ? set.reps * set.weight * conversionFactor : 0), 0
          ) * 100) / 100
        };
      }),
      completionPercentage: Math.round(
        (workoutProgress.reduce((acc, curr) => acc + curr.sets.filter(set => set.isCompleted).length, 0) /
        workoutProgress.reduce((acc, curr) => acc + curr.sets.length, 0)) * 100
      )
    };

    setWorkoutHistory(prev => [workoutHistoryEntry, ...prev]);

    // Shadow-write into the Progress 2.0 store so analytics + PR detection
    // pick the session up. localStorage remains the source of truth for now.
    try {
      void useProgressStore.getState().recordWorkout(workoutHistoryEntry);
    } catch (err) {
      console.warn('progressStore.recordWorkout failed', err);
    }

    // Update exercise history with weight units
    const exerciseHistoryEntries = workoutProgress.map(exercise => ({
      exerciseId: exercise.exercise.id,
      name: exercise.exercise.name,
      lastReps: exercise.sets[0]?.reps || 0,
      lastWeight: exercise.sets[0]?.weight || 0,
      lastRestTime: exercise.sets[0]?.restTime || 0,
      date: currentDate,
      weightUnit: exercise.weightUnit // Save the weight unit
    }));

    setExerciseHistory(prev => [...exerciseHistoryEntries, ...prev]);

    setShowCompletionModal(true);
    setWorkoutProgress([]);
    setIsLoadingInsights(false);
  };

  // Add useEffect to save workout history
  useEffect(() => {
    localStorage.setItem('workoutHistory', JSON.stringify(workoutHistory));
  }, [workoutHistory]);

  // Add useEffect to save exercise history
  useEffect(() => {
    localStorage.setItem('exerciseHistory', JSON.stringify(exerciseHistory));
  }, [exerciseHistory]);

  // Add useEffect to save custom plans
  useEffect(() => {
    localStorage.setItem('customPlans', JSON.stringify(customPlans));
  }, [customPlans]);

  // Add function to get recent workouts
  const getRecentWorkouts = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return workoutHistory
      .filter(workout => new Date(workout.date) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Update the generateWorkoutInsights function to use Gemini AI
  const generateWorkoutInsights = async (currentWorkout: ExerciseProgress[], history: WorkoutHistory[]) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Prepare workout data for AI analysis
      const workoutData = {
        currentWorkout: currentWorkout.map(exercise => ({
          name: exercise.exercise.name,
          sets: exercise.sets.map(set => ({
            reps: set.reps,
            weight: set.weight,
            isCompleted: set.isCompleted,
            restTime: set.restTime
          })),
          totalVolume: exercise.sets.reduce((acc, set) => 
            acc + (set.isCompleted ? set.reps * set.weight : 0), 0
          ),
          avgRPM: Math.round(exercise.sets.reduce((acc, set) => 
            acc + (set.isCompleted ? (set.reps * set.weight) / (set.restTime || 60) * 60 : 0
          ), 0) / exercise.sets.filter(set => set.isCompleted).length)
        })),
        recentHistory: history.slice(0, 5).map(workout => ({
          date: workout.date,
          muscleGroup: workout.muscleGroup,
          exercises: workout.exercises
        }))
      };

      const prompt = `You are an expert fitness trainer AI. Analyze this workout data and provide a concise, motivating insight about the user's performance. Focus on volume, intensity, and progress compared to recent workouts.

      Workout Data:
      ${JSON.stringify(workoutData, null, 2)}

      Provide a single paragraph insight (max 2-3 sentences) that highlights key achievements and areas for focus. Keep it motivational and specific to their performance metrics.`;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return "Great work on completing your workout! Keep pushing yourself and maintaining consistency for optimal results.";
    }
  };

  // Helper function to generate workout tags
  const generateWorkoutTags = (currentWorkout: ExerciseProgress[], history: WorkoutHistory[]) => {
    const tags: string[] = [];
    const recentWorkouts = getRecentWorkouts();

    // Volume comparison
    const currentVolume = currentWorkout.reduce((acc, curr) => 
      acc + curr.sets.reduce((setAcc, set) => 
        setAcc + (set.isCompleted ? set.reps * set.weight : 0), 0
      ), 0
    );
    const avgVolume = recentWorkouts.reduce((acc, workout) => 
      acc + workout.exercises.reduce((exAcc, ex) => 
        exAcc + (ex.reps * ex.weight * ex.setsCompleted), 0
      ), 0
    ) / (recentWorkouts.length || 1);

    if (currentVolume > avgVolume) tags.push("High Volume");
    if (currentVolume < avgVolume) tags.push("Recovery Focus");

    // Intensity metrics
    const avgRPM = Math.round(currentWorkout.reduce((acc, curr) => 
      acc + curr.sets.reduce((setAcc, set) => 
        setAcc + (set.isCompleted ? (set.reps * set.weight) / (set.restTime || 60) * 60 : 0
      ), 0) / curr.sets.filter(set => set.isCompleted).length
    , 0) / currentWorkout.length);

    if (avgRPM > 1000) tags.push("High Intensity");
    if (avgRPM < 500) tags.push("Controlled Pace");

    // Rest time analysis
    const avgRestTime = Math.round(currentWorkout.reduce((acc, curr) => 
      acc + curr.sets.reduce((setAcc, set) => 
        setAcc + (set.isCompleted ? set.restTime || 0 : 0
      ), 0) / curr.sets.filter(set => set.isCompleted).length
    , 0) / currentWorkout.length);

    if (avgRestTime < 60) tags.push("Quick Rest");
    if (avgRestTime > 120) tags.push("Full Recovery");

    // Check for PRs
    const hasPR = currentWorkout.some(exercise => {
      const maxWeight = Math.max(...exercise.sets.map(s => s.weight));
      const previousMax = history
        .flatMap(w => w.exercises)
        .filter(e => e.name === exercise.name)
        .reduce((max, e) => Math.max(max, e.weight), 0);
      return maxWeight > previousMax;
    });

    if (hasPR) tags.push("New PR");

    // Workout focus
    const muscleGroups = new Set(currentWorkout.flatMap(ex => ex.primaryMuscles));
    if (muscleGroups.size === 1) {
      tags.push("Isolation Focus");
    } else if (muscleGroups.size > 3) {
      tags.push(t('plan.full_body'));
    }

    return tags;
  };

  // Add useEffect to handle navigation hiding
  useEffect(() => {
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
      if (isWorkoutStarted) {
        nav.classList.add('hidden');
      } else {
        nav.classList.remove('hidden');
      }
    }
  }, [isWorkoutStarted]);
  
  // Do not lock body scroll during workout; allow the exercise list to scroll under the fixed footer.
  // We deliberately avoid toggling document.body.style.overflow here to prevent breaking page scrolling.

  // Add this useEffect to handle exercise filtering
  useEffect(() => {
    if (customPlanStep === 'exercises' && selectedCustomDay) {
      // Only filter exercises if it's NOT a rest day
      if (selectedCustomDay.focus !== t('plan.rest_day')) {
        const filtered = allExercises.filter(exercise => {
          // Search by name
          const matchesSearch = exercise.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase());
          
          // Filter by force type
          const matchesForce = selectedForceType === 'all' ||
            (selectedForceType === 'push' && (exercise.force === 'push' || exercise.primaryMuscles.some(m => ['chest', 'shoulders', 'triceps'].includes(m.toLowerCase())))) ||
            (selectedForceType === 'pull' && (exercise.force === 'pull' || exercise.primaryMuscles.some(m => ['back', 'biceps', 'traps'].includes(m.toLowerCase())))) ||
            (selectedForceType === 'static' && exercise.force === 'static') ||
            (selectedForceType === 'chest' && exercise.primaryMuscles.some(m => m.toLowerCase() === 'chest')) ||
            (selectedForceType === 'back' && exercise.primaryMuscles.some(m => ['back', 'traps', 'lats'].includes(m.toLowerCase()))) ||
            (selectedForceType === 'shoulders' && exercise.primaryMuscles.some(m => m.toLowerCase() === 'shoulders')) ||
            (selectedForceType === 'arms' && exercise.primaryMuscles.some(m => ['biceps', 'triceps'].includes(m.toLowerCase()))) ||
            (selectedForceType === 'legs' && exercise.primaryMuscles.some(m => ['quadriceps', 'hamstrings', 'calves', 'glutes'].includes(m.toLowerCase()))) ||
            (selectedForceType === 'core' && exercise.primaryMuscles.some(m => ['abdominals', 'lower back'].includes(m.toLowerCase())));
          
          // Filter by focus if specified
          const focusLower = selectedCustomDay.focus.toLowerCase();
          const matchesFocus = !focusLower.includes('upper') && !focusLower.includes('lower') && !focusLower.includes('push') && !focusLower.includes('pull') ? true :
            exercise.primaryMuscles.some(muscle => {
              if (focusLower.includes('upper')) {
                return ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(muscle.toLowerCase());
              } else if (focusLower.includes('lower')) {
                return ['quadriceps', 'hamstrings', 'calves', 'glutes'].includes(muscle.toLowerCase());
              } else if (focusLower.includes('push')) {
                return ['chest', 'shoulders', 'triceps'].includes(muscle.toLowerCase());
              } else if (focusLower.includes('pull')) {
                return ['back', 'biceps', 'traps'].includes(muscle.toLowerCase());
              }
              return true;
            });

          return matchesSearch && matchesForce && matchesFocus;
        });
        setFilteredExercises(filtered);
      } else {
        // If it's a rest day, show no exercises
        setFilteredExercises([]);
      }
    } else {
      setFilteredExercises([]);
    }
  }, [exerciseSearchQuery, selectedForceType, allExercises, customPlanStep, selectedCustomDay]);

  // Add this function to handle exercise selection
  const toggleExerciseSelection = (exercise: Exercise) => {
    setSelectedExercises(prev => {
      const isSelected = prev.some(e => e.id === exercise.id);
      if (isSelected) {
        return prev.filter(e => e.id !== exercise.id);
      } else {
        return [...prev, exercise];
      }
    });
  };

  // Add this effect to reset custom plan state when modal closes
  useEffect(() => {
    if (!showCustomPlanModal) {
      setCustomPlanStep('name');
      setNewCustomPlan({
        id: '',
        name: '',
        days: [],
        createdAt: ''
      });
      setSelectedCustomDay(null);
      setSelectedExercises([]);
      setExerciseSearchQuery('');
      setSelectedForceType('all');
    }
  }, [showCustomPlanModal]);

  // Add this component for rest days
  const RestDayView = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 py-12 relative overflow-hidden"
    >
      {/* Background Gradient Animation */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5"
        animate={{ 
          background: [
            "linear-gradient(to bottom right, rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.05))",
            "linear-gradient(to bottom right, rgba(236, 72, 153, 0.05), rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05))",
            "linear-gradient(to bottom right, rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.05), rgba(59, 130, 246, 0.05))"
          ]
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      {/* Floating Particles */}
      <motion.div 
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/10 rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -10, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Icon Container with Glow Effect */}
        <motion.div 
          className="relative w-24 h-24 mx-auto mb-8"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 1 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-2xl" />
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#2e2e32] to-[#1a1a1c] flex items-center justify-center border border-white/10">
        <Moon className="w-10 h-10 text-primary" />
      </div>
        </motion.div>

        {/* Title with Gradient */}
        <motion.h2 
          className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-800"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Rest & Recovery Day
        </motion.h2>

        {/* Description */}
        <motion.p 
          className="text-lg text-gray-700 mb-12"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Your body needs this break. Focus on recovery and light activities to prepare for your next session.
        </motion.p>

        {/* Cards Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {/* Recommended Activities Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <Wind className="w-5 h-5 text-gray-800" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Light Activities</h3>
            </div>
          <ul className="space-y-3">
              <li className="flex items-center gap-3 text-gray-700 group-hover:text-gray-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              Light stretching (15-20 mins)
            </li>
              <li className="flex items-center gap-3 text-gray-700 group-hover:text-gray-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              Gentle walking or swimming
            </li>
              <li className="flex items-center gap-3 text-gray-700 group-hover:text-gray-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              Yoga or mobility work
            </li>
          </ul>
          </div>

          {/* Recovery Tips Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                {/* Icon removed for minimal look */}
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Recovery Tips</h3>
            </div>
          <ul className="space-y-3">
              <li className="flex items-center gap-3 text-gray-700 group-hover:text-gray-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
              Stay hydrated throughout the day
            </li>
              <li className="flex items-center gap-3 text-gray-700 group-hover:text-gray-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
                Focus on proper nutrition
            </li>
              <li className="flex items-center gap-3 text-gray-700 group-hover:text-gray-800 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
                Get quality sleep (7-9 hours)
            </li>
          </ul>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  // Add reset function for custom plan modal
  const resetCustomPlanModal = () => {
    setCustomPlanStep('name');
    setNewCustomPlan({
      id: '',
      name: '',
      days: [],
      createdAt: ''
    });
    setSelectedCustomDay(null);
    setSelectedExercises([]);
    setExerciseSearchQuery('');
    setSelectedForceType('all');
  };

  // Update modal close handler
  const handleCustomPlanModalClose = () => {
    resetCustomPlanModal();
    setShowCustomPlanModal(false);
  };

  // Add delete custom plan function
  const handleDeleteCustomPlan = (planId: string) => {
    if (window.confirm('Are you sure you want to delete this custom plan? This action cannot be undone.')) {
      setCustomPlans(prev => prev.filter(p => p.id !== planId));
      localStorage.setItem('customPlans', JSON.stringify(customPlans.filter(p => p.id !== planId)));
    }
  };

  // Add strength focus exercises
  const strengthFocusExercises = {
    'Heavy Upper': [
      'bench_press', 'overhead_press', 'barbell_row', 'weighted_pullup',
      'incline_bench_press', 'military_press', 'dumbbell_row', 'lat_pulldown'
    ],
    'Heavy Lower': [
      'squat', 'deadlift', 'leg_press', 'romanian_deadlift',
      'front_squat', 'sumo_deadlift', 'hack_squat', 'good_morning'
    ],
    'Power Upper': [
      'push_press', 'clean_and_press', 'weighted_dips', 'power_row',
      'snatch_grip_press', 'muscle_ups', 'power_cleans', 'medicine_ball_throws'
    ],
    'Power Lower': [
      'power_clean', 'box_jump', 'jump_squat', 'kettlebell_swing',
      'hang_clean', 'depth_jump', 'power_snatch', 'medicine_ball_slam'
    ],
    'Technique Work': [
      'front_squat', 'clean_pull', 'snatch_grip_deadlift', 'push_press_technique',
      'clean_technique', 'snatch_balance', 'jerk_balance', 'overhead_squat'
    ]
  };

  // Add edit functionality
  const handleEditCustomPlan = (plan: CustomPlan) => {
    setNewCustomPlan(plan);
    setCustomPlanStep('name');
    setShowCustomPlanModal(true);
  };

  // Add this function to check if it's a rest day (handles localized labels and custom-plan empty days)
  const isRestDay = (focus: string) => {
    if (!focus) return false;
    const focusLower = focus.toLowerCase();
    const localizedRestLabels = [
      'rest',
      'recovery',
      'deload',
      t('plan.rest_day').toLowerCase(),
      t('plan.rest_cardio').toLowerCase(),
      t('plan.rest_core').toLowerCase(),
      t('plan.active_recovery').toLowerCase(),
    ];
    return (
      localizedRestLabels.some(lbl => focusLower.includes(lbl)) ||
      localizedRestLabels.includes(focusLower)
    );
  };

  // Update toggleWeightUnit to properly handle weight conversion
  const toggleWeightUnit = (exerciseIndex: number) => {
    setWorkoutProgress(prev => {
      const newProgress = [...prev];
      const exercise = newProgress[exerciseIndex];
      
      // Toggle weight unit
      const newUnit = exercise.weightUnit === 'kg' ? 'lb' : 'kg';
      exercise.weightUnit = newUnit;
      
      // Convert weights
      const conversionFactor = newUnit === 'lb' ? 2.20462 : 0.453592;
      exercise.sets = exercise.sets.map(set => ({
        ...set,
        weight: Math.round(set.weight * conversionFactor * 100) / 100
      }));
      
      return newProgress;
    });
  };

  // Add this to reset everything when closing the completion modal
  const handleCloseCompletionModal = () => {
    setShowCompletionModal(false);
    setWorkoutMetrics({
      totalVolume: 0,
      completedSets: 0,
      averageSetTime: 0,
      averageRestTime: 0,
      rpm: 0,
      totalWorkoutTime: 0,
      setTimes: []
    });
    setWorkoutProgress([]);
    setIsWorkoutStarted(false);
  };

  // Add motion values for custom plan modal
  const y = useMotionValue(0);

  // Add this useEffect at the top of the component with other effects
  useEffect(() => {
    if (showCustomPlanModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showCustomPlanModal]);

  const handleWorkoutPlanClick = () => {
    onClose();
    if (location.pathname === '/plan') {
      // If already on plan page, just trigger the button click
      const createPlanButton = document.querySelector('[data-create-plan-button]');
      if (createPlanButton) {
        (createPlanButton as HTMLElement).click();
      }
    } else {
      // If not on plan page, store flag and navigate
      localStorage.setItem('shouldOpenCustomPlan', 'true');
      navigate("/plan");
    }
  };

  const muscleGroups: MuscleGroup[] = [
    {
      id: 'push_pull',
      name: t('plan.push_pull_split'),
      color: 'from-[#4776E6]/50 to-[#8E54E9]/50 hover:from-[#4776E6]/70 hover:to-[#8E54E9]/70',
      image: upperBodyImg,
      primaryMuscles: [t('muscles.chest'), t('muscles.back'), t('muscles.shoulders'), t('muscles.biceps'), t('muscles.triceps')],
      workoutDays: [
        { day: 1, focus: t('plan.push_day'), exercises: [] },
        { day: 2, focus: t('plan.rest_cardio'), exercises: [] },
        { day: 3, focus: t('plan.pull_day'), exercises: [] },
        { day: 4, focus: t('plan.rest_core'), exercises: [] },
        { day: 5, focus: t('plan.full_body'), exercises: [] },
        { day: 6, focus: t('plan.active_recovery'), exercises: [] },
        { day: 7, focus: t('plan.rest_day'), exercises: [] }
      ]
    },
    {
      id: 'bro_split',
      name: t('plan.bro_split'),
      color: 'from-[#FF512F]/50 to-[#DD2476]/50 hover:from-[#FF512F]/70 hover:to-[#DD2476]/70',
      image: lowerBodyImg,
      primaryMuscles: [t('muscles.chest'), t('muscles.back'), t('muscles.shoulders'), t('muscles.arms'), t('muscles.legs')],
      workoutDays: [
        { day: 1, focus: t('plan.chest_day'), exercises: [] },
        { day: 2, focus: t('plan.back_day'), exercises: [] },
        { day: 3, focus: t('plan.shoulder_day'), exercises: [] },
        { day: 4, focus: t('plan.arm_day'), exercises: [] },
        { day: 5, focus: t('plan.leg_day'), exercises: [] },
        { day: 6, focus: t('plan.core_cardio'), exercises: [] },
        { day: 7, focus: t('plan.rest_day'), exercises: [] }
      ]
    },
    {
      id: 'upper_lower',
      name: t('plan.upper_lower_split'),
      color: 'from-[#11998e]/50 to-[#38ef7d]/50 hover:from-[#11998e]/70 hover:to-[#38ef7d]/70',
      image: fullBodyImg,
      primaryMuscles: [t('muscles.upper_body'), t('muscles.lower_body')],
      workoutDays: [
        { day: 1, focus: t('plan.upper_body'), exercises: [] },
        { day: 2, focus: t('plan.lower_body'), exercises: [] },
        { day: 3, focus: t('plan.rest_cardio'), exercises: [] },
        { day: 4, focus: t('plan.upper_body'), exercises: [] },
        { day: 5, focus: t('plan.lower_body'), exercises: [] },
        { day: 6, focus: t('plan.active_recovery'), exercises: [] },
        { day: 7, focus: t('plan.rest_day'), exercises: [] }
      ]
    },
    {
      id: 'custom',
      name: t('plan.custom_plan'),
      color: 'from-[#2e0f1a]/50 to-[#2e1220]/50 hover:from-[#2e0f1a]/70 hover:to-[#2e1220]/70',
      image: legsImg,
      primaryMuscles: [],
      workoutDays: []
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <NavHide isWorkoutStarted={isWorkoutStarted || showExerciseModal || showCustomPlanModal} />
      
      <div className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y -webkit-overflow-scrolling-touch" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
        <div className="mx-auto space-y-8 px-4 sm:px-6 py-6 pb-24 max-w-screen-md">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {!isWorkoutStarted ? (
            <motion.h1 
                  key="workout-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
              className="text-[1.75rem] tracking-tight text-black font-sf-display font-sf-bold"
            >
              {t('plan.workout_plan')}
            </motion.h1>
              ) : (
                <motion.div
                  key="workout-timer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-[1.75rem] tracking-tight text-black font-sf-display font-sf-bold"
                >
                  {formatTime(Math.floor(workoutMetrics.totalWorkoutTime))}
                </motion.div>
              )}
            </AnimatePresence>

            {user && !isWorkoutStarted && (
              <motion.div 
                initial={{ opacity: 1 }}
                animate={{ opacity: isWorkoutStarted ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center w-full -mt-1"
              >
                <div className="bg-gray-100 rounded-full p-1 flex items-center shadow-md border border-gray-200/50">
                  <Link
                    to="/plan"
                    className="px-5 py-2 rounded-full bg-white shadow-sm flex items-center gap-2.5 transition-all duration-200 border border-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">{t('plan.plan')}</span>
                    <ClipboardList className="w-4 h-4 text-primary" />
                  </Link>
                  <Link
                    to="/workouts"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('plan.library')}</span>
                    <Dumbbell className="w-4 h-4 text-gray-600" />
                  </Link>
                  <Link
                    to="/progress"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('plan.progress')}</span>
                    <BarChart3 className="w-4 h-4 text-gray-600" />
                  </Link>
                </div>
              </motion.div>
            )}
          </div>

          {/* Remove the Progress Button section */}
          {!selectedMuscle ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-[1800px] mx-auto"
            >
              {/* Empty div to maintain spacing */}
            </motion.div>
          ) : showProgressModal ? (
            null
          ) : null}

          {/* Main Content */}
          <AnimatePresence mode="wait">
            {!selectedMuscle ? (
              <motion.div 
                key="muscle-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6 max-w-[1800px] mx-auto"
              >
                {/* Workout Splits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {muscleGroups.slice(0, 3).map((muscleGroup, index) => (
                    <motion.button
                      key={muscleGroup.id}
                      onClick={() => setSelectedMuscle(muscleGroup.id)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.05 }}
                      className={cn(
                        "group relative w-full rounded-[36px] overflow-hidden text-left",
                        "border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700",
                        "bg-white dark:bg-zinc-900",
                        "shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700/60"
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="p-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-3xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
                              <Dumbbell className="h-5 w-5 text-zinc-900 dark:text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white tracking-tight">
                                {muscleGroup.name}
                              </h3>
                              <p className="text-xs text-zinc-500 dark:text-white/60">{t('plan.tap_to_view')}</p>
                            </div>
                          </div>
                          <div className="h-9 w-9 rounded-xl border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 grid place-items-center group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 transition-colors">
                            <ChevronRight className="h-4 w-4 text-zinc-700 dark:text-white/80" />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {muscleGroup.primaryMuscles.map((muscle, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-full text-xs bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700"
                            >
                              {muscle}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.button>
                  ))}

                  {/* Custom Plan Button */}
                  <div
                    onClick={() => setShowCustomPlanModal(true)}
                    data-create-plan-button
                    className="relative h-[140px] rounded-3xl overflow-hidden cursor-pointer bg-white shadow-lg border border-black/5"
                  >
                    <div className="h-full p-5 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-black mb-1.5">{t('plan.custom_plan')}</h3>
                        <p className="text-sm text-black/60">{t('plan.create_your_own')}</p>
                      </div>
                      <div className="flex items-center gap-2 text-primary">
                        <Plus className="w-5 h-5" />
                        <span className="text-sm font-medium">{t('plan.create_plan')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                 {/* Custom Plans List (if any exist) */}
                {customPlans.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">{t('plan.your_custom_plans')}</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {customPlans.map(plan => (
                        <motion.button
                          key={plan.id}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => {
                            setSelectedCustomPlan(plan);
                            setSelectedMuscle('custom');
                          }}
                          className="group relative p-6 rounded-3xl border border-black/5 bg-white shadow-lg transition-colors flex flex-col gap-5 text-left"
                        >
                          {/* Edit/Delete overlay (mirrored for RTL) */}
                          <div
                            className={cn(
                              "absolute top-3 flex gap-2 z-10",
                              isRTL ? "left-3 flex-row-reverse" : "right-3 flex-row"
                            )}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCustomPlan(plan);
                              }}
                              className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
                              aria-label="Edit custom plan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomPlan(plan.id);
                              }}
                              className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
                              aria-label="Delete custom plan"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 rounded-3xl bg-zinc-100 flex items-center justify-center">
                                <ClipboardList className="h-5 w-5 text-zinc-900" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight">
                                  {plan.name}
                                </h3>
                                <p className="text-xs text-zinc-500">{t('plan.tap_to_view')}</p>
                              </div>
                            </div>
                            {/* Removed ChevronRight icon for custom plan cards for cleaner look */}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {/* Days count chip */}
                            <span className="px-3 py-1 rounded-full text-xs bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {plan.days.length} {t('plan.days')}
                            </span>
                            {/* Show up to 5 day focuses as chips */}
                            {plan.days.slice(0, 5).map((day) => (
                              <span
                                key={day.id}
                                className="px-3 py-1 rounded-full text-xs bg-zinc-100 text-zinc-700 border border-zinc-200"
                              >
                                {day.focus || day.name}
                              </span>
                            ))}
                            {plan.days.length > 5 && (
                              <span className="px-3 py-1 rounded-full text-xs bg-zinc-50 text-zinc-600 border border-zinc-200">
                                +{plan.days.length - 5}
                              </span>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : !selectedDay ? (
              <motion.div
                key="days-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Back Button */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    className="gap-2 text-gray-900 hover:text-gray-900 bg-white hover:bg-gray-50 border border-black/10"
                    onClick={() => {
                      setSelectedMuscle(null);
                      setSelectedCustomPlan(null);
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t('plan.back_to_splits')}
                  </Button>
                </div>

                {/* Days List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1800px] mx-auto">
                  {selectedMuscle === 'custom' && selectedCustomPlan ? (
                    selectedCustomPlan.days.map((day, index) => (
                      <motion.div
                        key={day.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => {
                          setSelectedDay(index + 1);
                          // Only set exercises if it's not a rest day and has exercises
                          if (!isRestDay(day.focus)) {
                            setExercises(day.exercises || []); // Ensure we always set an array
                          } else {
                            setExercises([]);
                          }
                        }}
                        className="bg-gradient-to-br from-white to-cyan-50/50 shadow-lg hover:bg-white/95 transition-colors rounded-3xl overflow-hidden cursor-pointer group border border-black/5"
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                            {/* Day Number Container */}
                              <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 flex items-center justify-center">
                                <span className="text-2xl font-bold text-gray-900">
                                {index + 1}
                              </span>
                            </div>
                            <div className="text-left">
                                <h3 className="text-xl font-bold text-gray-900 mb-1">{day.name}</h3>
                                <p className="text-gray-600">{day.focus}</p>
                            </div>
                            </div>
                            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-gray-600 transition-all transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    muscleGroups.find(m => m.id === selectedMuscle)?.workoutDays.map((day, index) => {
                      const isRest = isRestDay(day.focus);
                      return (
                        <motion.div
                          key={day.day}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: day.day * 0.1 }}
                          onClick={() => {
                            if (!isWorkoutStarted) {
                              setSelectedDay(day.day);
                              if (!isRest) {
                                const selectedGroup = muscleGroups.find(m => m.id === selectedMuscle);
                                if (selectedGroup) {
                                  const dayExercises = selectExercisesForDay(selectedGroup, day.day);
                                  setExercises(dayExercises);
                                }
                              } else {
                                setExercises([]);
                              }
                            }
                          }}
                          className={cn(
                            "relative p-6 rounded-3xl cursor-pointer transition-all",
                            isRest 
                              ? "bg-gradient-to-br from-gray-50 to-gray-100/50 hover:from-gray-100 hover:to-gray-200/50" 
                              : "bg-gradient-to-br from-white to-cyan-50/50 hover:from-gray-50 hover:to-cyan-50/80",
                            "border border-black/5 shadow-lg"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            {/* Day Number Container */}
                            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 flex items-center justify-center">
                              <span className="text-2xl font-bold text-gray-900">
                                {day.day}
                              </span>
                            </div>
                            <div className="text-left">
                              <h3 className="text-xl font-bold text-gray-900 mb-1">Day {day.day}</h3>
                              <div className="flex items-center gap-2">
                                <p className="text-gray-600">{day.focus}</p>
                                {isRest ? (
                                  <Badge variant="outline" className="bg-gray-100/50 text-gray-500 border-gray-200">
                                    Rest Day
                                  </Badge>
                                ) : (
                                  day.exercises.length > 0 && (
                                  <div className="flex items-center gap-2">
                                      {/* Existing completion indicators */}
                                  </div>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* Ad placement after days list for non-pro users */}
                <ProFeatures showOnlyForNonPro>
                  <div className="w-full flex justify-center">
                  </div>
                </ProFeatures>
              </motion.div>
            ) : !isWorkoutStarted ? (
              <motion.div
                key="exercise-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Back to Days Button */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    className="gap-2 text-gray-900 hover:text-gray-900 bg-white hover:bg-gray-50 border border-black/10"
                    onClick={() => setSelectedDay(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t('plan.back_to_days')}
                  </Button>
                  {exercises.length > 0 && !isRestDay(selectedCustomDay?.focus || muscleGroups.find(m => m.id === selectedMuscle)?.workoutDays[selectedDay - 1]?.focus || '') && (
                  <Button
                    onClick={startWorkout}
                    className="gap-2 bg-primary text-white hover:bg-primary/90"
                  >
                    <Play className="w-4 h-4" />
                    {t('plan.start_workout')}
                  </Button>
                  )}
                </div>

                {/* Rest day simple view (minimal, no glow) */}
                {(
                  // Only show rest screen when the day focus clearly indicates a rest-type day
                  isRestDay(
                    selectedCustomDay?.focus ||
                    muscleGroups.find(m => m.id === selectedMuscle)?.workoutDays[selectedDay - 1]?.focus ||
                    ''
                  )
                ) ? (
                  <Card className="max-w-2xl mx-auto border border-gray-200 bg-white shadow-sm">
                    <CardContent className="p-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Bed className="w-10 h-10 text-gray-500 mb-3" />
                        <h2 className="text-xl font-semibold text-gray-900">{t('plan.rest_day')}</h2>
                        <p className="text-gray-600 mt-2 max-w-md">Light movement, hydration, and recovery.</p>
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                          <div className="p-4 rounded-xl border border-gray-200">
                            <p className="text-sm text-gray-700">Walk 10–20 min</p>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-200">
                            <p className="text-sm text-gray-700">Mobility 5–10 min</p>
                          </div>
                          <div className="p-4 rounded-xl border border-gray-200">
                            <p className="text-sm text-gray-700">Hydrate + protein</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exercises.map((exercise, index) => (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="p-6 rounded-xl bg-gradient-to-br from-white to-cyan-50/50 border border-black/5 shadow-lg hover:bg-white/95 transition-colors"
                      >
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">{exercise.name}</h3>
                            {/* Info button removed as per request to prevent popup from showing */}
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Equipment</span>
                              <p className="text-sm text-gray-900">{exercise.equipment || 'Bodyweight'}</p>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Level</span>
                              <p className="text-sm text-gray-900">{exercise.level}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Ad placement after exercise list for non-pro users */}
                <ProFeatures showOnlyForNonPro>
                  <div className="w-full flex justify-center">
                  </div>
                </ProFeatures>
              </motion.div>
            ) : (
              // Workout Progress Timeline
              <motion.div
                key="workout-progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Ad placement before workout progress for non-pro users */}
                <ProFeatures showOnlyForNonPro>
                  <div className="w-full flex justify-center">
                  </div>
                </ProFeatures>

                {/* Header with Controls */}
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{t('plan.workout_session')}</h3>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {selectedMuscle === 'custom' && selectedCustomPlan ? (
                          <>
                            {selectedCustomPlan.name} • {t('plan.day_label')} {selectedDay}
                          </>
                        ) : (
                          <>
                            {muscleGroups.find(m => m.id === selectedMuscle)?.name} • {t('plan.day_label')} {selectedDay}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="gap-2 text-gray-800 hover:text-gray-900 bg-gray-100/80 hover:bg-gray-100 border border-gray-200"
                        onClick={endWorkout}
                      >
                        <X className="w-4 h-4" />
                        {t('plan.end_workout')}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Rest Timer Overlay */}
                <AnimatePresence>
                  {isResting && currentRestTimer !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="fixed inset-x-0 bottom-24 z-50"
                    >
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Exercise Timeline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-screen-sm mx-auto">
                  {workoutProgress.map((exercise, exerciseIndex) => (
                    <motion.div
                      key={exercise.exercise.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: exerciseIndex === activeExerciseIndex ? 1 : 0.98
                      }}
                      transition={{ delay: exerciseIndex * 0.1 }}
                      className={cn(
                        "relative rounded-2xl p-6",
                        exerciseIndex === activeExerciseIndex 
                          ? "bg-gradient-to-br from-white to-cyan-50/50 shadow-lg border border-black/5" 
                          : exercise.isCompleted 
                            ? "bg-gradient-to-br from-white to-cyan-50/30 opacity-50 border border-black/5" 
                            : "bg-gradient-to-br from-white to-cyan-50/50 shadow-lg border border-black/5",
                        "transition-all duration-300",
                        "touch-pan-y"
                      )}
                      style={{ 
                        touchAction: 'pan-y', 
                        padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' 
                      }}
                    >
                      {/* Exercise Header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            exercise.isCompleted 
                              ? "bg-green-500/20 text-green-500" 
                              : exerciseIndex === activeExerciseIndex
                                ? "bg-primary/20 text-primary"
                                : "bg-gray-100 text-gray-400"
                          )}>
                            {exercise.isCompleted ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <span className="text-sm font-medium">{exerciseIndex + 1}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">
                              {exercise.exercise.name}
                            </h3>
                              <button
                                onClick={() => toggleWeightUnit(exerciseIndex)}
                                className="px-3 py-1.5 rounded-lg bg-gray-800/80 active:bg-gray-700/80 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <span className="text-sm font-medium text-white/90">
                                  {exercise.weightUnit.toUpperCase()}
                                </span>
                              </button>
                              {isAiConfigured() && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAICoachByExercise((prev) => ({
                                      ...prev,
                                      [exerciseIndex]: !prev[exerciseIndex],
                                    }));
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5",
                                    aiCoachByExercise[exerciseIndex]
                                      ? "bg-primary text-white"
                                      : "bg-primary/10 text-primary hover:bg-primary/20",
                                  )}
                                  title={t('aiCoach.toggle', { defaultValue: 'AI Mode' })}
                                >
                                  <Sparkles className="w-4 h-4" />
                                  <span className="text-sm font-medium">
                                    {t('aiCoach.toggle', { defaultValue: 'AI Mode' })}
                                  </span>
                                </button>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm">
                              {exercise.sets.filter(s => s.isCompleted).length}/{exercise.sets.length} sets completed
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newProgress = [...workoutProgress];
                            newProgress[exerciseIndex] = {
                              ...newProgress[exerciseIndex],
                              isExpanded: !newProgress[exerciseIndex].isExpanded
                            };
                            setWorkoutProgress(newProgress);
                          }}
                        >
                          {exercise.isExpanded ? (
                            <Minus className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Sets Timeline */}
                      <AnimatePresence>
                        {exercise.isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4 ml-4 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-gray-200 touch-pan-y"
                            style={{ touchAction: 'pan-y' }}
                          >
                            {exercise.sets.map((set, setIndex) => (
                              <motion.div
                                key={set.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ 
                                  opacity: 1, 
                                  x: 0,
                                  scale: exerciseIndex === activeExerciseIndex && setIndex === activeSetIndex ? 1.02 : 1
                                }}
                                transition={{ delay: setIndex * 0.1 }}
                                className={cn(
                                  "flex items-center gap-4 pl-8 relative",
                                  set.isCompleted && "text-gray-400",
                                  exerciseIndex === activeExerciseIndex && setIndex === activeSetIndex && "ring-2 ring-primary/20 rounded-2xl"
                                )}
                              >
                                {/* Timeline Node */}
                                <div
                                  className={cn(
                                    "absolute left-0 w-4 h-4 rounded-full -translate-x-[9px]",
                                    set.isCompleted
                                      ? "bg-green-500"
                                      : set.isResting
                                        ? "bg-yellow-500"
                                        : "bg-red-500",
                                    "transition-colors duration-300"
                                  )}
                                />

                                {/* Set Content */}
                                <div
                                  className={cn(
                                    "flex-1 bg-white rounded-2xl p-5 space-y-4 border border-gray-200 shadow-sm",
                                    set.isCompleted && "opacity-50"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">{t('plan.exercise.set')} {setIndex + 1}</span>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-gray-600"
                                        onClick={() => removeSet(exerciseIndex, setIndex)}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                          "text-gray-400 hover:text-gray-600",
                                          set.isCompleted && "text-green-500"
                                        )}
                                        onClick={() => handleSetComplete(exerciseIndex, setIndex)}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4">
                                    {/* Reps Input */}
                                    <div className="flex flex-col items-center space-y-2">
                                      <label className="text-sm font-medium text-gray-900">{t('plan.exercise.reps')}</label>
                                      <div className="flex flex-col items-center gap-2">
                                        <input
                                          type="number"
                                          value={set.reps || ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? null : parseInt(e.target.value);
                                            updateSetValue(exerciseIndex, setIndex, 'reps', value);
                                          }}
                                          className="w-[72px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          step={1}
                                          min={0}
                                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                          onFocus={(e) => e.currentTarget.select?.()}
                                          // @ts-ignore
                                          style={{ touchAction: 'manipulation' }}
                                        />
                                        <button
                                          onClick={() => {
                                            if (set.reps) {
                                              setWorkoutProgress(prev => {
                                                const newProgress = [...prev];
                                                newProgress[exerciseIndex].sets.forEach((s, i) => {
                                                  if (i !== setIndex) {
                                                    s.reps = set.reps;
                                                  }
                                                });
                                                return newProgress;
                                              });
                                            }
                                          }}
                                          className="text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Weight Input */}
                                    <div className="flex flex-col items-center space-y-2">
                                      <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-900">Weight ({exercise.weightUnit.toUpperCase()})</label>
                                      </div>
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="relative">
                                          <input
                                            type="number"
                                            value={set.weight || ''}
                                            onChange={(e) => {
                                              const value = e.target.value === '' ? null : parseInt(e.target.value);
                                              updateSetValue(exerciseIndex, setIndex, 'weight', value);
                                            }}
                                            className="w-[72px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
                                            inputMode="decimal"
                                            step={1}
                                            min={0}
                                            // @ts-ignore
                                            style={{ touchAction: 'manipulation' }}
                                          />
                                        </div>
                                        <button
                                          onClick={() => {
                                            if (set.weight !== null && set.weight !== undefined) {
                                              setWorkoutProgress(prev => {
                                                const newProgress = [...prev];
                                                newProgress[exerciseIndex].sets.forEach((s, i) => {
                                                  if (i !== setIndex) {
                                                    s.weight = set.weight;
                                                  }
                                                });
                                                return newProgress;
                                              });
                                            }
                                          }}
                                          className="text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Rest Timer */}
                                    <div className="flex flex-col items-center space-y-2">
                                      <label className="text-sm font-medium text-gray-900">Rest</label>
                                      <div className="flex flex-col items-center gap-2">
                                        <input
                                          type="number"
                                          value={set.restTime || ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? null : parseInt(e.target.value);
                                            updateSetValue(exerciseIndex, setIndex, 'restTime', value);
                                          }}
                                          className="w-[72px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
                                          inputMode="numeric"
                                          step={1}
                                          min={0}
                                          // @ts-ignore
                                          style={{ touchAction: 'manipulation' }}
                                        />
                                        <button
                                          onClick={() => {
                                            if (set.restTime) {
                                              setWorkoutProgress(prev => {
                                                const newProgress = [...prev];
                                                newProgress[exerciseIndex].sets.forEach((s, i) => {
                                                  if (i !== setIndex) {
                                                    s.restTime = set.restTime;
                                                  }
                                                });
                                                return newProgress;
                                              });
                                            }
                                          }}
                                          className="text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Apply to All Sets Button */}
                                  <div className="flex justify-center gap-8 mt-2">
                                    <button
                                      onClick={() => applyValueToAllSets('reps', set.reps)}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => applyValueToAllSets('weight', set.weight)}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => applyValueToAllSets('restTime', set.restTime)}
                                      className="text-gray-500 hover:text-gray-700"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            ))}

                            {/* Add Set Button */}
                            <motion.button
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={() => addSet(exerciseIndex)}
                              className="ml-8 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 transition-colors flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Add Set
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {/* AI Coach panel (per exercise). Reads completed_reps from
                          the FastAPI backend and writes it into the active set's
                          reps field via setWorkoutProgress — so the existing
                          workoutHistory + progressStore shadow-write are untouched. */}
                      {aiCoachByExercise[exerciseIndex] && exercise.isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="mt-4 pt-4 border-t border-black/5"
                        >
                          <AICoachPanel
                            compact
                            exercise={exercise.exercise.name}
                            onRepDetected={(totalReps) => {
                              setWorkoutProgress((prev) => {
                                const next = [...prev];
                                const ex = next[exerciseIndex];
                                if (!ex) return prev;
                                const activeSetIdx = ex.sets.findIndex((s) => !s.isCompleted);
                                if (activeSetIdx === -1) return prev;
                                const set = ex.sets[activeSetIdx];
                                if (set.reps === totalReps) return prev;
                                ex.sets = ex.sets.map((s, i) =>
                                  i === activeSetIdx ? { ...s, reps: totalReps } : s,
                                );
                                next[exerciseIndex] = { ...ex };
                                return next;
                              });
                            }}
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Ad placement after workout progress for non-pro users */}
                <ProFeatures showOnlyForNonPro>
                  <div className="w-full flex justify-center">
                  </div>
                </ProFeatures>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Exercise Detail Modal */}
      <AnimatePresence>
        {showExerciseModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] touch-none"
              onClick={() => {
                if (selectedImage === null) {
                  setShowExerciseModal(false);
                }
              }}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                duration: 0.3,
                ease: [0.32, 0.72, 0, 1]
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
              className="fixed bottom-0 left-0 right-0 z-[100001]"
            >
              <div className="bg-white rounded-t-[24px] overflow-hidden shadow-2xl mx-auto max-w-[420px] h-[85vh] relative flex flex-col">
                {/* Handle */}
                <motion.div 
                  className="pt-3 pb-2 flex justify-center flex-shrink-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="w-12 h-1 bg-gray-200 rounded-full" />
                </motion.div>

                {/* Header - No border, no X button */}
                <motion.div 
                  className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-2.5 rounded-xl">
                    <Info className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-semibold text-gray-900 tracking-tight">{selectedExercise?.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedExercise?.primaryMuscles.map((muscle, index) => (
                        <div
                          key={muscle}
                          className="px-2 py-0.5 rounded-md bg-gray-100 text-[12px] text-gray-600"
                        >
                          {muscle}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                <div className={cn(
                  "flex-1 overflow-y-auto px-6 py-4",
                  isDragging && "pointer-events-none"
                )}>
                  <div className="py-6 space-y-8">
                    {/* Exercise Images */}
                    {selectedExercise && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="px-6"
                      >
                        <div 
                          ref={imageContainerRef}
                          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 p-1.5 group"
                        >
                          <motion.div
                            className="flex transition-transform duration-300 ease-out"
                            style={{
                              touchAction: 'none',
                              transform: `translateX(${-currentImageIndex * 100}%)`
                            }}
                          >
                            {selectedExercise.images.map((image, index) => (
                              <motion.div
                                key={index}
                                className="relative min-w-full cursor-pointer"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1, duration: 0.4 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedImage(index);
                                  setCurrentImageIndex(index);
                                }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 transition-colors" />
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/20">
                                  <img 
                                    src={image}
                                    alt={`${selectedExercise.name} - Position ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-500"
                                    draggable="false"
                                    loading="lazy"
                                    onError={(e) => {
                                      const img = e.target as HTMLImageElement;
                                      img.src = '/placeholder-exercise.jpg';
                                    }}
                                  />
                                </div>
                              </motion.div>
                            ))}
                          </motion.div>

                          {/* Image Navigation */}
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-3">
                            <button
                              onClick={(e) => switchImage(e, 'prev')}
                              className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                              style={{ opacity: currentImageIndex === 0 ? 0.5 : 1 }}
                              disabled={currentImageIndex === 0}
                            >
                              <ChevronRight className="w-5 h-5 text-white transform rotate-180" />
                            </button>
                            <button
                              onClick={(e) => switchImage(e, 'next')}
                              className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                              style={{ opacity: currentImageIndex === selectedExercise.images.length - 1 ? 0.5 : 1 }}
                              disabled={currentImageIndex === 1}
                            >
                              <ChevronRight className="w-5 h-5 text-white" />
                            </button>
                          </div>

                          {/* Image Dots */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                            {[0, 1].map((index) => (
                              <button
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(index);
                                }}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                  currentImageIndex === index 
                                    ? 'bg-white scale-125' 
                                    : 'bg-white/40 hover:bg-white/60'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Instructions */}
                    <motion.div 
                      className="space-y-4 px-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-2.5 rounded-xl">
                          <Info className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-[17px] font-semibold text-gray-900 tracking-tight">Instructions</h3>
                      </div>
                      <ul className="space-y-3">
                        {selectedExercise?.instructions.map((step, index) => (
                          <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + index * 0.1 }}
                            className="flex gap-3 text-gray-600 bg-gradient-to-r from-gray-50 to-gray-100/50 p-4 rounded-xl backdrop-blur-sm hover:bg-gray-100 transition-colors border border-gray-200"
                          >
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-sm font-medium text-primary">
                              {index + 1}
                            </span>
                            <p className="text-[15px] leading-relaxed">{step}</p>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Fullscreen Image Modal */}
            <AnimatePresence>
              {selectedImage !== null && selectedExercise && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000] flex items-center justify-center"
                  onClick={() => setSelectedImage(null)}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="relative max-w-4xl w-full mx-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 p-1.5">
                      <img
                        src={selectedExercise.images[currentImageIndex]}
                        alt={`${selectedExercise.name} - ${currentImageIndex === 0 ? 'Start' : 'End'} position`}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>

                    {/* Navigation Buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(currentImageIndex === 0 ? 1 : 0);
                      }}
                      className="absolute top-1/2 right-4 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm border border-white/10 group"
                      style={{ display: currentImageIndex === 1 ? 'none' : 'block' }}
                    >
                      <ChevronRight className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(currentImageIndex === 0 ? 1 : 0);
                      }}
                      className="absolute top-1/2 left-4 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm border border-white/10 group"
                      style={{ display: currentImageIndex === 0 ? 'none' : 'block' }}
                    >
                      <ChevronLeft className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                    </button>

                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-12 right-0 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm border border-white/10 group"
                    >
                      <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                    </button>

                    {/* Image Counter */}
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white/80">
                      <span className="text-sm font-medium">
                        {currentImageIndex === 0 ? 'Start Position' : 'End Position'}
                      </span>
                      <div className="flex items-center gap-2">
                        {[0, 1].map((index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentImageIndex(index);
                            }}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              currentImageIndex === index 
                                ? 'bg-white scale-125' 
                                : 'bg-white/40 hover:bg-white/60'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>

      {/* Workout Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && (
          <>
            <NavHide isAIOpen={showCompletionModal} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={cn(
                  "bg-white p-6 rounded-2xl w-full max-w-md mx-auto space-y-6",
                  hasCompletedAnySets 
                    ? "from-white to-white" 
                    : "from-white to-white"
                )}
              >
                {hasCompletedAnySets ? (
                  <>
                    {/* Workout Complete Content */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 truncate">{t('plan.workout.workout_complete')}</h2>
                        <p className="text-sm text-gray-600 truncate">
                          {selectedMuscle === 'custom' 
                            ? selectedCustomPlan?.name 
                            : muscleGroups.find(m => m.id === selectedMuscle)?.name} • {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Rest of workout completion content */}
                    <div className="space-y-4">
                      {/* Workout Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-600">{t('plan.workout.total_volume')}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {workoutMetrics.totalVolume.toLocaleString()} {weightUnit}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-600">{t('plan.workout.completed_sets')}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {workoutMetrics.completedSets}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-600">{t('plan.workout.avg_set_time')}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {workoutMetrics.averageSetTime}s
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-600">{t('plan.workout.avg_rest_time')}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {Math.round(workoutMetrics.averageRestTime)}s
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-600">{t('plan.workout.rpm')}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {workoutMetrics.rpm || 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-600">{t('plan.workout.total_time')}</p>
                          <p className="text-lg font-bold text-gray-900">
                            {formatTime(workoutMetrics.totalWorkoutTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleCloseCompletionModal}
                          className="w-full bg-gray-100 text-gray-900 rounded-xl py-3 font-medium hover:bg-gray-200 transition-colors"
                        >
                          {t('plan.back_to_days')}
                        </button>
                        <button
                          onClick={() => {
                            handleCloseCompletionModal();
                            navigate('/progress');
                          }}
                          className="w-full bg-black text-white rounded-xl py-3 font-medium hover:bg-black/90 transition-colors"
                        >
                          {t('plan.view_progress')}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* See You Next Time Content */}
                    <div className="relative w-24 h-24 mx-auto">
                      <motion.div
                        animate={{ 
                          rotate: 360,
                          scale: [1, 1.1, 1],
                        }}
                        transition={{ 
                          rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                          scale: { duration: 2, repeat: Infinity }
                        }}
                        className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-xl"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Timer className="w-12 h-12 text-primary" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-gray-900 text-center">{t('plan.workout.see_you_next_time')}</h2>
                      <p className="text-gray-600 text-center">{t('plan.workout.see_you_message')}</p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full text-gray-900"
                      onClick={handleCloseCompletionModal}
                    >
                      {t('plan.back_to_days')}
                    </Button>
                  </>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Plan Modal */}
      <AnimatePresence>
        {showCustomPlanModal && (
          <>
            <NavHide isAIOpen={showCustomPlanModal} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed top-[-100vh] inset-x-0 bottom-0 h-[400vh] bg-black/60 backdrop-blur-sm z-[99998] touch-none overscroll-none"
              onClick={handleCustomPlanModalClose}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                duration: 0.3,
                ease: [0.32, 0.72, 0, 1]
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
              className="fixed bottom-0 left-0 right-0 z-[99999]"
            >
              <motion.div 
                className="bg-white/95 backdrop-blur-xl rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] relative flex flex-col"
                animate={{ 
                  height: customPlanStep === 'name' ? '40vh' : '85vh'
                }}
                transition={{
                  height: { type: "spring", damping: 40, stiffness: 300 }
                }}
              >
                <div className="pt-4 pb-2 flex justify-center flex-shrink-0">
                  <div className="w-10 h-1 bg-black/10 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-6 pb-2">
                  {customPlanStep !== 'name' && (
                    <button
                      onClick={() => {
                        if (customPlanStep === 'exercises') setCustomPlanStep('days');
                        else if (customPlanStep === 'days') setCustomPlanStep('name');
                      }}
                      className="p-2 -ml-2 text-black/80 hover:text-black"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  <AnimatePresence mode="wait">
                    <motion.h2 
                      key={customPlanStep}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-xl font-bold text-black flex-1 text-center"
                    >
                      {customPlanStep === 'name' ? t('plan.custom_modal.create_custom_plan') :
                       customPlanStep === 'days' ? t('plan.custom_modal.add_training_days') :
                       t('plan.custom_modal.select_exercises')}
                    </motion.h2>
                  </AnimatePresence>
                  {customPlanStep === 'name' && <div className="w-9" />}
                </div>
                <div className={cn(
                  "flex-1 overflow-y-auto overscroll-contain px-6 py-4",
                  isDragging && "pointer-events-none"
                )}>
                  <AnimatePresence mode="wait">
                    {/* Name Step */}
                    {customPlanStep === 'name' && (
                      <motion.div 
                        key="name-step"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <Input
                          placeholder={t('plan.custom_modal.plan_name')}
                          value={newCustomPlan.name}
                          onChange={(e) => setNewCustomPlan(prev => ({
                            ...prev,
                            name: e.target.value
                          }))}
                          className="bg-black/5 border-black/10 text-black placeholder:text-black/40"
                        />
                        <Button
                          className="w-full bg-primary text-white active:opacity-90 transition-opacity"
                          onClick={() => {
                            if (newCustomPlan.name.trim()) {
                              setCustomPlanStep('days');
                            }
                          }}
                          disabled={!newCustomPlan.name.trim()}
                        >
                          {t('plan.custom_modal.continue')}
                        </Button>
                      </motion.div>
                    )}

                    {/* Days Step */}
                    {customPlanStep === 'days' && (
                      <motion.div 
                        key="days-step"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="space-y-3">
                          {newCustomPlan.days.map((day, index) => (
                            <motion.div 
                              key={day.id} 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center gap-3"
                            >
                            <Input
                              placeholder={t('plan.custom_modal.day_name')}
                              value={day.name}
                              onChange={(e) => {
                                const updatedDays = [...newCustomPlan.days];
                                updatedDays[index].name = e.target.value;
                                setNewCustomPlan(prev => ({
                                  ...prev,
                                  days: updatedDays
                                }));
                              }}
                              className="bg-white/5 border-white/10 text-black flex-1 shadow-lg shadow-black/5 placeholder:text-black/60"
                            />
                            <Input
                              placeholder={t('plan.custom_modal.focus_placeholder')}
                              value={day.focus}
                              onChange={(e) => {
                                const updatedDays = [...newCustomPlan.days];
                                updatedDays[index].focus = e.target.value;
                                setNewCustomPlan(prev => ({
                                  ...prev,
                                  days: updatedDays
                                }));
                              }}
                              className="bg-white/5 border-white/10 text-black flex-1 shadow-lg shadow-black/5 placeholder:text-black/60"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updatedDays = newCustomPlan.days.filter((_, i) => i !== index);
                                setNewCustomPlan(prev => ({
                                  ...prev,
                                  days: updatedDays
                                }));
                              }}
                              className="text-black/40 active:bg-white/10 shadow-lg shadow-black/5"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            </motion.div>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          className="w-full bg-white/5 border-white/10 text-black/90 active:opacity-90 transition-opacity shadow-lg shadow-black/5 hover:text-black/90 hover:bg-white/5"
                          onClick={() => {
                            setNewCustomPlan(prev => ({
                              ...prev,
                              days: [
                                ...prev.days,
                                {
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: `Day ${prev.days.length + 1}`,
                                  focus: '',
                                  exercises: []
                                }
                              ]
                            }));
                          }}
                        >
                          {t('plan.custom_modal.add_day')}
                        </Button>

                        <div className="flex gap-3">
                          <Button
                            variant="ghost"
                            className="flex-1 text-black/60 active:opacity-90 transition-opacity shadow-lg shadow-black/5"
                            onClick={() => setCustomPlanStep('name')}
                          >
                            {t('plan.custom_modal.back')}
                          </Button>
                          <Button
                            className="flex-1 bg-primary text-white active:opacity-90 transition-opacity shadow-lg shadow-black/5"
                            onClick={() => {
                              if (newCustomPlan.days.length > 0) {
                                setCustomPlanStep('exercises');
                                setSelectedCustomDay(newCustomPlan.days[0]);
                              }
                            }}
                            disabled={newCustomPlan.days.length === 0}
                          >
                            {t('plan.custom_modal.continue')}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Exercises Step */}
                    {customPlanStep === 'exercises' && selectedCustomDay && (
                      <motion.div 
                        key="exercises-step"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold text-black">{selectedCustomDay.name}</h3>
                          <p className="text-black/60">{selectedCustomDay.focus}</p>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={t('plan.custom_modal.search_exercises')}
                            value={exerciseSearchQuery}
                            onChange={(e) => setExerciseSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-black placeholder-black/40 shadow-lg shadow-black/5"
                          />
                        </div>

                        {/* Force Type Filter */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                          {[
                            'all',
                            'push',
                            'pull',
                            'static',
                            'chest',
                            'back',
                            'shoulders',
                            'arms',
                            'legs',
                            'core',
                            'rest'
                          ].map((type) => (
                            <motion.button
                              key={type}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: type === 'rest' ? 1.05 : 1 }}
                              onClick={() => {
                                if (type === 'rest') {
                                  const updatedDays = [...newCustomPlan.days];
                                  const dayIndex = updatedDays.findIndex(d => d.id === selectedCustomDay.id);
                                  if (dayIndex !== -1) {
                                    updatedDays[dayIndex] = {
                                      ...updatedDays[dayIndex],
                                      focus: t('plan.rest_day'),
                                      exercises: []
                                    };
                                    setNewCustomPlan(prev => ({
                                      ...prev,
                                      days: updatedDays
                                    }));
                                    setSelectedCustomDay({
                                      ...selectedCustomDay,
                                      focus: t('plan.rest_day'),
                                      exercises: []
                                    });
                                  }
                                } else {
                                  setSelectedForceType(type as 'all' | 'pull' | 'push' | 'static');
                                }
                              }}
                              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-lg shadow-black/5 ${
                                type === 'rest'
                                  ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-500 hover:from-red-500/30 hover:to-red-600/30 border border-red-500/20 shadow-lg shadow-red-500/10'
                                  : selectedForceType === type 
                                    ? 'bg-primary text-white scale-105 shadow-lg shadow-primary/20' 
                                    : 'bg-white/5 text-black/60 hover:bg-white/10 hover:text-black/80'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {type === 'rest' ? (
                                  <>
                                    <Moon className="w-4 h-4" />
                                    <span>{t('plan.custom_modal.set_as_rest_day')}</span>
                                  </>
                                ) : (
                                  type.charAt(0).toUpperCase() + type.slice(1)
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>

                        {/* Exercise List */}
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pb-20">
                          {selectedCustomDay?.focus === t('plan.rest_day') ? (
                            <RestDayView />
                          ) : isLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                          ) : filteredExercises.length > 0 ? (
                            filteredExercises.map((exercise) => {
                              const isSelected = selectedExercises.some(e => e.id === exercise.id);
                              return (
                                <motion.div
                                  key={exercise.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  onClick={() => toggleExerciseSelection(exercise)}
                                  className={`p-4 rounded-xl border transition-all cursor-pointer shadow-lg shadow-black/5 ${
                                    isSelected 
                                      ? 'bg-primary/20 border-primary/30' 
                                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg bg-black/20 overflow-hidden">
                                      {exercise.images?.[0] ? (
                                        <img 
                                          src={exercise.images[0]} 
                                          alt={exercise.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-black/20">
                                          <Dumbbell className="w-8 h-8 text-gray-600" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="text-black font-medium">{exercise.name}</h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm text-black/60">{exercise.category}</span>
                                        {exercise.force && (
                                          <>
                                            <span className="text-black/40">•</span>
                                            <span className="text-sm text-black/60">{exercise.force}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                      isSelected 
                                        ? 'bg-primary border-2 border-primary' 
                                        : 'border-2 border-white/20 bg-white/5'
                                    }`}>
                                      {isSelected && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-black/40">{t('plan.custom_modal.no_exercises_found')}</p>
                            </div>
                          )}
                        </div>

                        {/* Navigation Buttons - Fixed at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/80 to-transparent">
                          <div className="flex gap-3">
                            <Button
                              variant="ghost"
                              className="flex-1 text-black/60"
                              onClick={() => {
                                setCustomPlanStep('days');
                                setSelectedCustomDay(null);
                                setSelectedExercises([]);
                                setExerciseSearchQuery('');
                              }}
                            >
                              {t('plan.custom_modal.back')}
                            </Button>
                            <Button
                              className="flex-1 bg-primary text-white active:opacity-90 transition-opacity shadow-lg shadow-black/5"
                              onClick={() => {
                                // Save exercises to the current day
                                const updatedDays = [...newCustomPlan.days];
                                const currentDayIndex = updatedDays.findIndex(d => d.id === selectedCustomDay.id);
                                if (currentDayIndex !== -1) {
                                  updatedDays[currentDayIndex] = {
                                    ...updatedDays[currentDayIndex],
                                    exercises: selectedExercises
                                  };
                                  setNewCustomPlan(prev => ({
                                    ...prev,
                                    days: updatedDays
                                  }));
                                }

                                // Move to next day or finish
                                const nextDayIndex = currentDayIndex + 1;
                                if (nextDayIndex < updatedDays.length) {
                                  setSelectedCustomDay(updatedDays[nextDayIndex]);
                                  setSelectedExercises(updatedDays[nextDayIndex].exercises || []);
                                } else {
                                  // Save the plan
                                  const finalPlan = {
                                    ...newCustomPlan,
                                    id: newCustomPlan.id || Math.random().toString(36).substr(2, 9),
                                    createdAt: new Date().toISOString()
                                  };
                                  setCustomPlans(prev => [...prev, finalPlan]);
                                  localStorage.setItem('customPlans', JSON.stringify([...customPlans, finalPlan]));
                                  
                                  // Reset and close
                                  handleCustomPlanModalClose();
                                }
                              }}
                            >
                              {selectedCustomDay && newCustomPlan.days.findIndex(d => d.id === selectedCustomDay.id) === newCustomPlan.days.length - 1 
                                ? t('plan.custom_modal.finish') 
                                : t('plan.custom_modal.next_day')
                              }
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/** bottom-only white gradient overlay for popup container */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white" />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Rest Timer Modal */}
      <AnimatePresence>
        {isResting && currentRestTimer !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-2xl w-full max-w-md mx-4 text-center space-y-6"
            >
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-100"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray="364.4"
                    strokeDashoffset={364.4 * (1 - currentRestTimer / (workoutProgress[activeExerciseIndex]?.sets[activeSetIndex]?.restTime || 60))}
                    className="text-primary transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900">{currentRestTimer}s</span>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">{t('plan.rest_timer.rest_time')}</h2>
                <p className="text-gray-600">{t('plan.rest_timer.take_break')}</p>
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                onClick={() => {
                    if (currentRestTimer && currentRestTimer > 5) {
                      setCurrentRestTimer(currentRestTimer - 5);
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  {t('plan.exercise.decrease_time')}
                </button>
                <button
                  onClick={() => {
                    if (currentRestTimer) {
                      setCurrentRestTimer(currentRestTimer + 5);
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  {t('plan.exercise.increase_time')}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full text-gray-900"
                  onClick={skipRest}
                >
                  {t('plan.rest_timer.skip_rest')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Set/Workout Button */}
      {isWorkoutStarted && workoutProgress.length > 0 && (
        <>
          {/* Spacer to allow list scrolling behind the fixed footer on mobile */}
          <div className="h-24" />
          <div className="pointer-events-none fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
            <button
              onClick={handleProgression}
              className="pointer-events-auto w-full bg-black text-white rounded-xl py-4 font-medium text-base hover:bg-black/90 transition-colors"
            >
              {currentExerciseIndex === workoutProgress.length - 1 && 
               currentSetIndex === workoutProgress[currentExerciseIndex]?.sets.length - 1 
                ? t('plan.exercise.complete_workout')
                : t('plan.exercise.next_set')}
            </button>
          </div>
        </>
      )}

      {/* Floating Timer */}
      {isFloatingTimer && currentRestTimer && (
        <motion.div
          ref={floatingTimerRef}
          drag
          dragMomentum={false}
          onDragEnd={handleFloatingTimerDrag}
          initial={false}
          animate={{
            x: timerPosition.x,
            y: timerPosition.y
          }}
          style={{
            position: 'fixed',
            zIndex: 9999,
            touchAction: 'none'
          }}
          className="bg-white rounded-full w-[100px] h-[100px] shadow-lg flex items-center justify-center cursor-move"
        >
          <div className="text-2xl font-bold text-gray-900">
            {formatTime(currentRestTimer)}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Plan;