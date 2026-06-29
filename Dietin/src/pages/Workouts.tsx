import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useWorkoutStore } from '@/stores/workoutStore';
import {
  ChevronRight, X, Loader2,
  ArrowLeft, RefreshCw, Info, Search, Heart, HeartOff, Dumbbell, ClipboardList, Plus, Activity, BarChart3
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
import { Link, useLocation } from 'react-router-dom';
import NavHide from "@/components/NavHide";
import { useTranslation } from 'react-i18next';

// Import images
import chestImg from '../assets/chest.jpeg';
import backImg from '../assets/back.jpeg';
import legsImg from '../assets/legs.jpeg';
import shouldersImg from '../assets/shoulders.jpeg';
import armsImg from '../assets/arms.jpeg';
import coreImg from '../assets/core.jpeg';
import cardioImg from '../assets/cardio.jpeg';
import pullImg from '../assets/pull.jpeg';
import pushImg from '../assets/push.jpeg';
import staticImg from '../assets/static.jpeg';

// Import exercises data
import exerciseData from '@/data/exercises.json';

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

interface MuscleGroup {
  id: string;
  name: string;
  color: string;
  image: string;
  primaryMuscles: string[];
}

const muscleGroups: MuscleGroup[] = [
  {
    id: 'chest',
    name: 'muscles.chest',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: chestImg,
    primaryMuscles: ['muscles.chest']
  },
  {
    id: 'back',
    name: 'muscles.back',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: backImg,
    primaryMuscles: ['muscles.sub_muscles.middle_back', 'muscles.sub_muscles.lower_back', 'muscles.sub_muscles.lats', 'muscles.sub_muscles.traps']
  },
  {
    id: 'legs',
    name: 'muscles.legs',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: legsImg,
    primaryMuscles: ['muscles.sub_muscles.quadriceps', 'muscles.sub_muscles.hamstrings', 'muscles.sub_muscles.calves', 'muscles.sub_muscles.glutes', 'muscles.sub_muscles.adductors', 'muscles.sub_muscles.abductors']
  },
  {
    id: 'shoulders',
    name: 'muscles.shoulders',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: shouldersImg,
    primaryMuscles: ['muscles.shoulders']
  },
  {
    id: 'arms',
    name: 'muscles.arms',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: armsImg,
    primaryMuscles: ['muscles.biceps', 'muscles.triceps', 'muscles.sub_muscles.forearms']
  },
  {
    id: 'core',
    name: 'muscles.core',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: coreImg,
    primaryMuscles: ['muscles.sub_muscles.abdominals', 'muscles.sub_muscles.lower_back']
  },
  {
    id: 'favorites',
    name: 'plan.favorites',
    color: 'from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80',
    image: cardioImg,
    primaryMuscles: []
  }
];

const BASE_IMAGE_URL = '/exercises/';

const Workouts = () => {
  const { t } = useTranslation();
  const { favorites, addFavorite, removeFavorite } = useWorkoutStore();
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedForceType, setSelectedForceType] = useState<string | null>(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAllExercises, setFilteredAllExercises] = useState<Exercise[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const y = useMotionValue(0);

  // Helpers to normalize muscle keys (e.g., 'muscles.sub_muscles.lower_back' → 'lower back')
  const normalize = (value: string) => value.toLowerCase().replace(/_/g, ' ');
  const muscleKeyToName = (key: string) => normalize(key.split('.').pop() || key);

  // Favorites are stored locally via Zustand persist; no Firestore sync needed

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

  const handleDragEnd = () => {
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

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update exercise loading
  useEffect(() => {
    const loadExercises = async () => {
      const CACHE_KEY = 'workouts_exercises_cache_v1';
      const META_KEY = 'workouts_exercises_fetch_meta_v1';
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      try {
        setIsLoading(true);

        // Read fetch meta and enforce max 2 fetches per 24h (per day boundary)
        const metaRaw = localStorage.getItem(META_KEY);
        const meta = metaRaw ? JSON.parse(metaRaw) as { day: string; count: number } : { day: today, count: 0 };
        const resetMeta = meta.day !== today;
        const count = resetMeta ? 0 : meta.count || 0;

        // Try to use cache first if fetch limit reached
        if (count >= 2) {
          const cachedRaw = localStorage.getItem(CACHE_KEY);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as any[];
            setAllExercises(cached);
            setFilteredAllExercises(cached);
            setIsLoading(false);
            return;
          }
          // No cache available; fall through to attempt a fetch once, but do NOT increase count beyond limit
        }

        // Load exercises from the public directory
        const response = await fetch('/exercises.json');
        if (!response.ok) throw new Error(`Failed to fetch /exercises.json: ${response.status}`);
        const data = await response.json();

        // Map the exercise data to include image paths
        const mappedExercises = data.map((exercise: any) => ({
          ...exercise,
          id: exercise.name.replace(/\s+/g, '_'),  // Generate ID from name if not present
          images: [
            `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/0.jpg`,
            `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/1.jpg`
          ]
        }));

        // Cache the mapped data
        localStorage.setItem(CACHE_KEY, JSON.stringify(mappedExercises));
        const newMeta = {
          day: today,
          count: Math.min(2, (resetMeta ? 0 : count) + 1),
        };
        localStorage.setItem(META_KEY, JSON.stringify(newMeta));

        console.log(`Loaded ${mappedExercises.length} exercises`);
        setAllExercises(mappedExercises);
        setFilteredAllExercises(mappedExercises);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading exercises:', error);
        // Fallback to cache on error
        const cachedRaw = localStorage.getItem('workouts_exercises_cache_v1');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as any[];
          setAllExercises(cached);
          setFilteredAllExercises(cached);
        } else {
          // Fallback to bundled data import as last resort
          try {
            const mappedExercises = (exerciseData as any[]).map((exercise: any) => ({
              ...exercise,
              id: exercise.name.replace(/\s+/g, '_'),
              images: [
                `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/0.jpg`,
                `${BASE_IMAGE_URL}${exercise.name.replace(/\s+/g, '_')}/1.jpg`
              ]
            }));
            setAllExercises(mappedExercises);
            setFilteredAllExercises(mappedExercises);
          } catch (e) {
            console.error('Failed to load fallback exercise data in Workouts:', e);
          }
        }
        setIsLoading(false);
      }
    };

    loadExercises();
  }, []);

  const filterExercises = (muscleGroup: MuscleGroup) => {
    setIsLoading(true);
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

  const searchPlaceholder = !selectedMuscle
    ? t("workouts.search_all_exercises")
    : t("workouts.search_in_muscle_group", { muscle: t(muscleGroups.find(m => m.id === selectedMuscle)?.name || '') });

  const getFilteredExercises = () => {
    if (!selectedMuscle) {
      const matchingExercises = allExercises.filter(exercise =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.primaryMuscles.some(muscle =>
          muscle.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        (exercise.force && exercise.force.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      const exercisesByMuscle = new Map<string, number>();
      matchingExercises.forEach(exercise => {
        // Count force type exercises
        if (exercise.force) {
          const forceType = exercise.force.toLowerCase() + '-exercises';
          exercisesByMuscle.set(forceType, (exercisesByMuscle.get(forceType) || 0) + 1);
        }

        // Count muscle group exercises
        exercise.primaryMuscles.forEach(muscle => {
          muscleGroups.slice(3, -1).forEach(group => { // Start from index 3 to skip force types
            const groupMuscles = group.primaryMuscles.map(muscleKeyToName);
            if (groupMuscles.includes(normalize(muscle))) {
              exercisesByMuscle.set(group.id, (exercisesByMuscle.get(group.id) || 0) + 1);
            }
          });
        });
      });

      // Get all matching groups including force types
      const filteredGroups = muscleGroups.filter(group =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercisesByMuscle.has(group.id)
      );

      return filteredGroups;
    } else {
      return exercises.filter(exercise =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.primaryMuscles.some(muscle =>
          muscle.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        (exercise.equipment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.level.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exercise.force && exercise.force.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
  };

  // Update search results when query changes
  useEffect(() => {
    if (!selectedMuscle && searchQuery.trim() === '') {
      setFilteredAllExercises(allExercises);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return;

    const results = allExercises.filter(exercise => {
      const nameMatch = exercise.name.toLowerCase().includes(query);
      const muscleMatch = exercise.primaryMuscles.some(muscle =>
        muscle.toLowerCase().includes(query)
      );
      const equipmentMatch = exercise.equipment?.toLowerCase().includes(query) || false;
      const forceMatch = exercise.force?.toLowerCase().includes(query) || false;
      const levelMatch = exercise.level.toLowerCase().includes(query);

      return nameMatch || muscleMatch || equipmentMatch || forceMatch || levelMatch;
    });

    setFilteredAllExercises(results);
  }, [searchQuery, allExercises, selectedMuscle]);

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

  // Add useEffect to refilter when force type changes
  useEffect(() => {
    if (selectedMuscle && selectedMuscle !== 'favorites') {
      const selectedGroup = muscleGroups.find(m => m.id === selectedMuscle);
      if (selectedGroup) {
        filterExercises(selectedGroup);
      }
    }
  }, [selectedForceType]);

  const getExerciseImages = (exercise: Exercise) => {
    return exercise.images;
  };

  return (
    <div className="h-full">
      <NavHide isWorkoutStarted={showExerciseModal} />

      <div className="h-full overflow-y-auto">
        <div className="container mx-auto space-y-8 p-6 pb-24 max-w-[1920px]">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-[1.75rem] tracking-tight text-black font-sf-display font-sf-bold"
            >
              {t("workouts.exercise_library")}
            </motion.h1>

            <div className="flex justify-center w-full -mt-1">
              <div className="bg-gray-100 rounded-full p-1 flex items-center shadow-md border border-gray-200/50">
                <Link
                  to="/plan"
                  className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                >
                  <span className="text-sm font-medium text-gray-600">{t("plan.plan")}</span>
                  <ClipboardList className="w-4 h-4 text-gray-600" />
                </Link>
                <Link
                  to="/workouts"
                  className="px-5 py-2 rounded-full bg-white shadow-sm flex items-center gap-2.5 transition-all duration-200 border border-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">{t("workouts.library")}</span>
                  <Dumbbell className="w-4 h-4 text-primary" />
                </Link>
                <Link
                  to="/progress"
                  className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                >
                  <span className="text-sm font-medium text-gray-600">{t("plan.progress")}</span>
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                </Link>
              </div>
            </div>
          </div>

          {/* Modern Spotify-like Search */}
          <div className="relative mb-4 md:mb-6" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="pl-12 bg-white shadow-lg border-black/5 text-black placeholder:text-black/40 rounded-full h-12 text-sm pr-12 transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchFocused(false);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Search Dropdown */}
              {isSearchFocused && searchQuery.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{
                    opacity: 1,
                    y: 8,
                    scale: 1,
                    transition: {
                      type: 'spring',
                      damping: 30,
                      stiffness: 400,
                      mass: 0.5
                    }
                  }}
                  exit={{
                    opacity: 0,
                    y: 4,
                    scale: 0.98,
                    transition: { duration: 0.15 }
                  }}
                  className="absolute z-50 w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 max-h-[60vh] overflow-y-auto transform origin-top"
                >
                  <div className="divide-y divide-gray-100">
                    {filteredAllExercises.length > 0 ? (
                      <>
                        <div className="p-4 bg-gray-50 border-b">
                          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                            {t('workouts.search_results')} ({filteredAllExercises.length})
                          </h3>
                        </div>
                        {filteredAllExercises.slice(0, 10).map((exercise) => (
                          <motion.div
                            key={exercise.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
                            onClick={() => {
                              setSelectedExercise(exercise);
                              setShowExerciseModal(true);
                              setIsSearchFocused(false);
                            }}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              transition: {
                                type: 'spring',
                                stiffness: 500,
                                damping: 30
                              }
                            }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center">
                              <Dumbbell className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">{exercise.name}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                  {exercise.equipment || 'Bodyweight'}
                                </span>
                                <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                                  {exercise.level}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          </motion.div>
                        ))}
                      </>
                    ) : searchQuery.trim() ? (
                      <div className="p-8 text-center">
                        <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No results found</h3>
                        <p className="text-gray-500 mt-1">Try different keywords or check your spelling</p>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Back Button */}
            {selectedMuscle && (
              <div className="flex items-center justify-between mt-4 md:mt-6 mb-4 md:mb-6">
                <Button
                  variant="ghost"
                  className="gap-2 text-gray-900 hover:text-gray-900 bg-white hover:bg-gray-50 border border-black/10"
                  onClick={() => setSelectedMuscle(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("workouts.back_to_categories")}
                </Button>
              </div>
            )}

            {/* Force Type Filter Buttons removed per request */}

            {/* Main Content */}
            <AnimatePresence mode="wait">
              {!selectedMuscle ? (
                <motion.div
                  key="muscle-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-6 md:mt-8 space-y-8 max-w-[1800px] mx-auto"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredExercises().map((muscle, index) => (
                      <motion.button
                        key={muscle.id}
                        onClick={() => handleMuscleSelect(muscle.id)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={cn(
                          "group relative w-full rounded-[28px] overflow-hidden text-left",
                          "border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700",
                          "bg-white dark:bg-gradient-to-br dark:from-zinc-900/70 dark:via-zinc-900/50 dark:to-zinc-800/50",
                          "shadow-md hover:shadow-lg",
                          "transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700/60"
                        )}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {/* Content */}
                        <div className="relative h-full p-6 md:p-8 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
                                  <Dumbbell className="w-5 h-5 text-zinc-900 dark:text-white" />
                                </div>
                                <h3 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">
                                  {t(muscle.name)}
                                </h3>
                              </div>
                              <div className="h-9 w-9 rounded-xl border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 grid place-items-center group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 transition-colors">
                                <ChevronRight className="w-4 h-4 text-zinc-700 dark:text-white/80" />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                              {muscle.primaryMuscles.map((muscleType, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1 rounded-full text-xs md:text-sm bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700"
                                >
                                  {t(muscleType)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-6">
                            <span className="text-sm font-medium text-zinc-500 dark:text-white/60">
                              {t("workouts.view_exercises")}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="exercise-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 md:mt-8 space-y-6"
                >
                  {/* Exercise List */}
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center py-12"
                      >
                        <div className="flex items-center gap-3 text-white/60">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>{t("workouts.loading_exercises")}...</span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        {getFilteredExercises().map((exercise, index) => (
                          <motion.div
                            key={exercise.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="p-6 rounded-3xl bg-white border border-black/5 shadow-lg hover:bg-white/95 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedExercise(exercise);
                              setShowExerciseModal(true);
                            }}
                          >
                            <div className="flex flex-col space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900">{exercise.name}</h3>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(exercise); }}
                                  >
                                    {favorites.some(fav => fav.id === exercise.id) ? (
                                      <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                                    ) : (
                                      <HeartOff className="w-5 h-5" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                  <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">{t("workouts.equipment")}</span>
                                  <p className="text-sm text-gray-900">{exercise.equipment || 'Bodyweight'}</p>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">{t("workouts.level")}</span>
                                  <p className="text-sm text-gray-900">{exercise.level}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Exercise Detail Modal + Fullscreen Image Modal via Portal */}
        {typeof document !== 'undefined' && createPortal(
          <div id="workouts-modal-portal" className="contents">
            <AnimatePresence>
              {showExerciseModal && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998] touch-none"
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
                      type: "spring",
                      damping: 40,
                      stiffness: 400,
                      mass: 0.8
                    }}
                    drag="y"
                    dragDirectionLock
                    dragElastic={0.2}
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragMomentum={false}
                    onDrag={(event, info) => {
                      if (info.offset.y < 0) {
                        y.set(0);
                      }
                    }}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={(event, info) => {
                      if (info.offset.y > 100) {
                        setShowExerciseModal(false);
                      } else {
                        y.set(0);
                      }
                      setIsDragging(false);
                    }}
                    style={{ y }}
                    className="fixed bottom-0 inset-x-0 z-[99999] touch-none"
                  >
                    <div className="bg-white rounded-t-[24px] overflow-hidden shadow-2xl mx-auto max-w-[420px] h-[85vh] relative flex flex-col">
                      <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                        <div className="w-10 h-1 bg-gray-200 rounded-full" />
                      </div>

                      <div className="flex-1 overflow-y-auto">
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
                                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20">
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
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                                  {selectedExercise.images.map((_, index) => (
                                    <button
                                      key={index}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImageIndex(index);
                                      }}
                                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentImageIndex === index
                                          ? 'bg-black scale-125'
                                          : 'bg-black/40 hover:bg-black/60'
                                        }`}
                                    />
                                  ))}
                                </div>

                                {/* Arrow Navigation */}
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (currentImageIndex > 0) {
                                        setCurrentImageIndex(currentImageIndex - 1);
                                      }
                                    }}
                                    className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                                    style={{ opacity: currentImageIndex === 0 ? 0.5 : 1 }}
                                    disabled={currentImageIndex === 0}
                                  >
                                    <ChevronRight className="w-5 h-5 text-white transform rotate-180" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (currentImageIndex < selectedExercise.images.length - 1) {
                                        setCurrentImageIndex(currentImageIndex + 1);
                                      }
                                    }}
                                    className="p-2.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                                    style={{ opacity: currentImageIndex === selectedExercise.images.length - 1 ? 0.5 : 1 }}
                                    disabled={currentImageIndex === selectedExercise.images.length - 1}
                                  >
                                    <ChevronRight className="w-5 h-5 text-white" />
                                  </button>
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
                              <h3 className="text-[17px] font-semibold text-gray-900 tracking-tight">{t("workouts.instructions")}</h3>
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
                </>
              )}

              {/* Fullscreen Image Modal */}
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
                      <div className="relative w-full h-full">
                        <motion.div
                          className="flex transition-transform duration-300 ease-out"
                          style={{
                            transform: `translateX(${-currentImageIndex * 100}%)`
                          }}
                        >
                          {selectedExercise.images.map((image, index) => (
                            <div
                              key={index}
                              className="relative min-w-full"
                            >
                              <img
                                src={image}
                                alt={`${selectedExercise.name} - ${index === 0 ? 'Start' : 'End'} position`}
                                className="w-full h-full object-contain rounded-xl"
                              />
                            </div>
                          ))}
                        </motion.div>
                      </div>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentImageIndex > 0) {
                            setCurrentImageIndex(currentImageIndex - 1);
                          }
                        }}
                        className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                        style={{ opacity: currentImageIndex === 0 ? 0.5 : 1 }}
                        disabled={currentImageIndex === 0}
                      >
                        <ChevronRight className="w-6 h-6 text-white transform rotate-180" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentImageIndex < selectedExercise.images.length - 1) {
                            setCurrentImageIndex(currentImageIndex + 1);
                          }
                        }}
                        className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                        style={{ opacity: currentImageIndex === selectedExercise.images.length - 1 ? 0.5 : 1 }}
                        disabled={currentImageIndex === selectedExercise.images.length - 1}
                      >
                        <ChevronRight className="w-6 h-6 text-white" />
                      </button>
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(null);
                      }}
                      className="absolute -top-12 right-0 p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>

                    {/* Image Counter */}
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3">
                      <span className="text-sm font-medium text-black">
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
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentImageIndex === index
                                ? 'bg-black scale-125'
                                : 'bg-black/40 hover:bg-black/60'
                              }`}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default Workouts; src = { image }
alt = {`${selectedExercise.name} - ${index === 0 ? 'Start' : 'End'} position`}
className = "w-full h-full object-contain rounded-xl"
  />
                          </div >
                        ))}
                      </motion.div >
                    </div >
                  </div >

  {/* Navigation Arrows */ }
  < div className = "absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-6" >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentImageIndex > 0) {
                          setCurrentImageIndex(currentImageIndex - 1);
                        }
                      }}
                      className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                      style={{ opacity: currentImageIndex === 0 ? 0.5 : 1 }}
                      disabled={currentImageIndex === 0}
                    >
                      <ChevronRight className="w-6 h-6 text-white transform rotate-180" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentImageIndex < selectedExercise.images.length - 1) {
                          setCurrentImageIndex(currentImageIndex + 1);
                        }
                      }}
                      className="p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
                      style={{ opacity: currentImageIndex === selectedExercise.images.length - 1 ? 0.5 : 1 }}
                      disabled={currentImageIndex === selectedExercise.images.length - 1}
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </button>
                  </div >

  {/* Close Button */ }
  < button
onClick = {(e) => {
  e.stopPropagation();
  setSelectedImage(null);
}}
className = "absolute -top-12 right-0 p-3 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transform transition-transform hover:scale-110"
  >
  <X className="w-5 h-5 text-white" />
                  </button >

  {/* Image Counter */ }
  < div className = "absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3" >
                    <span className="text-sm font-medium text-black">
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
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                            currentImageIndex === index 
                              ? 'bg-black scale-125' 
                              : 'bg-black/40 hover:bg-black/60'
                          }`}
                        />
                      ))}
                    </div>
                  </div >
                </motion.div >
              </motion.div >
            )}
          </AnimatePresence >
         </div >,
  document.body
       )}
     </div >
   );
 };

export default Workouts;