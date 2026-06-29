import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';
import { UserProfile, ActivityLevel, ExperienceLevel, WorkoutDays, Gender, Budget, Goal } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  ChevronRight,
  ChevronLeft,
  User,
  Scale,
  Activity,
  Calendar,
  AlertCircle,
  Apple,
  CreditCard,
  Sparkles,
  Target,
  LineChart,
  Salad,
  Bot,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  Youtube as YoutubeIcon,
  Tv as TvIcon,
  Users as UsersIcon,
  ThumbsDown,
  ThumbsUp,
  BarChart,
  Pizza,
  Users,
  Calendar as CalendarIcon,
  Apple as AppleIcon,
  Drumstick,
  Fish,
  Leaf,
  Sun,
  Dumbbell,
  Heart
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Line } from 'react-chartjs-2';
import ProSubscriptionPanel from './ProSubscriptionPanel';

// Add TikTok and Google icons since they're not in lucide-react
const TikTokIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 015.9 5.82v4.5a4.278 4.278 0 008.5 0v-8.5a7.741 7.741 0 007.7 7.7v-4.5a3.276 3.276 0 01-3.25-3.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.84 8.52c0 3.37-2.36 5.76-5.84 5.76-3.37 0-6.14-2.73-6.14-6.1S7.63 4.08 11 4.08c1.5 0 2.84.54 3.9 1.42l-1.6 1.6c-.45-.42-1.23-.91-2.3-.91-1.96 0-3.58 1.65-3.58 3.63 0 1.98 1.62 3.63 3.58 3.63 2.27 0 3.13-1.64 3.27-2.48h-3.27V8.52h5.84z" fill="currentColor" />
  </svg>
);

const inputClasses = "w-full px-4 py-3 rounded-2xl bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-300 font-['SF Pro Display'] shadow-md";
const selectClasses = "w-full px-4 py-3 rounded-2xl bg-white text-black focus:outline-none focus:ring-2 focus:ring-black/20 transition-all duration-300 font-['SF Pro Display'] shadow-md";
const buttonClasses = (selected: boolean) => cn(
  "w-full px-4 py-4 rounded-2xl text-center transition-all duration-200 font-['SF Pro Display']",
  selected
    ? "bg-[#3E3E3E] text-white scale-[0.98] shadow-lg [&_*]:text-white"
    : "bg-white text-black hover:bg-black/5 shadow-md"
);
const cardClasses = "bg-white shadow-lg border border-black/5 rounded-2xl p-6 hover:bg-white/95 transition-all duration-300";

const IntroStep = ({ onComplete }: { onComplete: () => void }) => {
  const { t } = useTranslation();
  const [textIndex, setTextIndex] = useState(0);
  const texts = [
    t('welcome.intro.hi', 'Hi.'),
    t('welcome.intro.welcome', 'Welcome to Dietin'),
    t('welcome.intro.unlock', "Let's unlock your full potential.")
  ];
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!isExiting) {
      const timer = setTimeout(() => {
        if (textIndex < texts.length - 1) {
          setTextIndex(prev => prev + 1);
        } else {
          setIsExiting(true);
          setTimeout(() => {
            onComplete();
          }, 1500);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [textIndex, isExiting, onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#FAFAFA] from-0% via-[#F8F8F8] via-30% via-[#F5F5F5] via-60% to-[#F0F0F0] to-100%">
      <AnimatePresence mode="wait" initial={true}>
        {!isExiting && (
          <motion.div
            key={textIndex}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: {
                duration: 0.5,
                ease: "easeInOut"
              }
            }}
            exit={{
              opacity: 0,
              transition: {
                duration: 0.5,
                ease: "easeInOut"
              }
            }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold text-black font-['SF Pro Display']">
              {texts[textIndex]}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function Welcome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { updateUser } = useUserStore();
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  // Local state to keep custom region input independent of quick-select buttons
  const [customRegionActive, setCustomRegionActive] = useState(false);
  const [customRegion, setCustomRegion] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showProPanel, setShowProPanel] = useState(false);
  const [aiResult, setAiResult] = useState<{
    goal: string;
    calories: number;
    metabolism: number;
    protein: number;
    carbs: number;
    fat: number;
    estimatedWeeks: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStepReady, setAiStepReady] = useState(false);
  const [currentAiText, setCurrentAiText] = useState(0);
  const [isNameValid, setIsNameValid] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);
  const [useMetric, setUseMetric] = useState(true);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);

  // Deterministic, rule-based name validation
  const validateName = (raw: string): boolean => {
    const name = (raw || "").trim();
    if (!name) return false;
    if (name.length < 2 || name.length > 40) return false;
    // Disallow emojis and non-letter basic symbols; allow spaces, apostrophes and hyphens
    if (/[^\p{L}\p{M}\s'’-]/u.test(name)) return false;
    if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(name)) return false;
    // No single character repeated 3+ times
    if (/(.)\1{2,}/.test(name)) return false;
    // Token checks
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length > 4) return false;
    if (tokens.some(t => t.length < 2)) return false;
    // Must start with a letter
    if (!/^[\p{L}]/u.test(name)) return false;
    // Basic garbage blacklist
    const lower = name.toLowerCase();
    const blacklist = [
      'asdf', 'qwerty', 'zxcv', 'test', 'name', 'abc', 'unknown', 'n/a', 'na', 'none', 'null', 'user', 'me', 'idk'
    ];
    if (blacklist.some(b => lower === b || lower.includes(b))) return false;
    return true;
  };

  const updateForm = (updates: Partial<UserProfile>) => {
    // Remove rate limiting for form updates
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    const now = Date.now();
    if (now - lastInteractionTime < 1000) return;
    setLastInteractionTime(now);

    setIsVisible(false);

    // Check if we're on the DietinPro step
    if (step === steps.findIndex(s => s.title === "Upgrade to DietinPro")) {
      // Allow moving to next step after DietinPro
      setTimeout(() => {
        setStep(prev => prev + 1); // Move to AI Analysis loader step
        setIsVisible(true);
        // Start local analysis (no external AI)
        setIsAnalyzing(true);

        const result = computeUserAnalysis(formData, useMetric);
        setAiResult(result);

        // Brief loader, then go to final step
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            setStep(steps.length - 1); // Move to final step
            setIsAnalyzing(false);
            setAiStepReady(true);
            setIsVisible(true);
          }, 500);
        }, 2500);
      }, 500);
      return;
    }

    if (step === steps.length - 3) {
      // Move to AI loader, compute locally, then finish
      setIsAnalyzing(true);
      setTimeout(() => {
        setStep(step + 1);
        setIsVisible(true);
        const result = computeUserAnalysis(formData, useMetric);
        setAiResult(result);
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            setStep(steps.length - 1);
            setIsAnalyzing(false);
            setAiStepReady(true);
            setIsVisible(true);
          }, 500);
        }, 2000);
      }, 500);
      return;
    }

    // Normal step transition
    setTimeout(() => {
      // Ensure viewport resets before the next step shows
      scrollToTopImmediate();
      setStep(prev => prev + 1);
      setTimeout(() => {
        setIsVisible(true);
      }, 1500);
    }, 500);
  };

  // Robust scroll-to-top helper
  const scrollToTopImmediate = () => {
    try {
      if (typeof window !== 'undefined') {
        // Instant jump to top
        window.scrollTo(0, 0);
      }
      const de = document?.documentElement as HTMLElement | undefined;
      const b = document?.body as HTMLElement | undefined;
      if (de) de.scrollTop = 0;
      if (b) b.scrollTop = 0;
    } catch { }
  };

  // Ensure scroll resets to top on step change for better UX
  useEffect(() => {
    scrollToTopImmediate();
  }, [step]);

  const prevStep = () => {
    const now = Date.now();
    if (now - lastInteractionTime < 1000) return; // Prevent navigation within 1 second
    setLastInteractionTime(now);

    setIsVisible(false);
    setTimeout(() => {
      scrollToTopImmediate();
      setStep(prev => prev - 1);
      setIsVisible(true);
    }, 500);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (e) {
      console.error(e);
      toast.error(t('auth.signOutFailed', { defaultValue: "We couldn't sign you out. Please try again." }));
    }
  };

  // Deterministic, non-AI recommended target weight calculator
  // Uses widely accepted BMI midpoint (22) to compute a healthy-weight target
  // and nudges toward it based on the user's goal. Never returns the same
  // weight as current, enforcing a minimal delta depending on unit system.
  const computeRecommendedTargetWeight = (
    currentWeight: number,
    heightCm: number | null | undefined,
    goal: Goal | null | undefined,
    useMetricUnits: boolean
  ): number => {
    const MIN_DELTA = useMetricUnits ? 0.5 : 1; // ensure target differs from current
    if (!currentWeight || currentWeight <= 0) return useMetricUnits ? 50 : 110; // sensible fallback

    // Compute recommended (BMI-based) target in kg first
    let recommendedKg: number | null = null;
    if (heightCm && heightCm > 0) {
      const heightM = heightCm / 100;
      const HEALTHY_BMI = 22; // midpoint of 18.5–24.9
      recommendedKg = HEALTHY_BMI * heightM * heightM;
    }

    // Convert recommended target to the user's current unit system
    const recommendedInUserUnits = (() => {
      if (recommendedKg == null) return null;
      return useMetricUnits ? recommendedKg : Math.round(recommendedKg * 2.20462);
    })();

    // Helper to ensure minimal difference from current
    const ensureNotEqual = (val: number): number => {
      if (Math.abs(val - currentWeight) < (useMetricUnits ? 0.0001 : 0.0001)) {
        // Move by minimal delta based on goal direction or toward healthy midpoint
        if (goal === 'LOSE_WEIGHT' || goal === 'LOSE_FAT') return currentWeight - MIN_DELTA;
        if (goal === 'GAIN_WEIGHT' || goal === 'GAIN_MUSCLE') return currentWeight + MIN_DELTA;
        // For MAINTAIN/RECOMPOSITION or unknown, nudge toward midpoint if available
        if (recommendedInUserUnits != null) {
          return recommendedInUserUnits < currentWeight ? currentWeight - MIN_DELTA : currentWeight + MIN_DELTA;
        }
        return currentWeight + MIN_DELTA;
      }
      return val;
    };

    let target = currentWeight;
    if (goal === 'LOSE_WEIGHT' || goal === 'LOSE_FAT') {
      if (recommendedInUserUnits != null) {
        target = Math.min(currentWeight - MIN_DELTA, recommendedInUserUnits);
      } else {
        // Fallback: 10–15% reduction
        target = currentWeight * 0.9;
      }
    } else if (goal === 'GAIN_WEIGHT' || goal === 'GAIN_MUSCLE') {
      if (recommendedInUserUnits != null) {
        target = Math.max(currentWeight + MIN_DELTA, recommendedInUserUnits);
      } else {
        // Fallback: 10–15% increase
        target = currentWeight * 1.1;
      }
    } else if (goal === 'RECOMPOSITION' || goal === 'MAINTAIN_HEALTH' || goal === 'MAINTAIN_ATHLETIC' || !goal) {
      // Move slightly toward healthy midpoint; if already close, still nudge by MIN_DELTA
      if (recommendedInUserUnits != null) {
        target = recommendedInUserUnits < currentWeight ? currentWeight - MIN_DELTA : currentWeight + MIN_DELTA;
      } else {
        // Without height, nudge minimally based on presumed direction (default upward)
        target = currentWeight + MIN_DELTA;
      }
    }

    // Round to UI step
    if (useMetricUnits) {
      target = Math.round(target * 10) / 10; // slider step is 0.1 kg
    } else {
      target = Math.round(target); // slider step is 1 lb
    }

    // Ensure result is not equal to current
    target = ensureNotEqual(target);
    return target;
  };

  const handleGetStarted = async () => {
    const now = Date.now();
    if (now - lastInteractionTime < 1000) return;
    setLastInteractionTime(now);

    setIsLoading(true);

    try {
      // Normalize values and prepare unit metadata
      const unitSystem = useMetric ? 'METRIC' : 'IMPERIAL';
      const heightCm = formData.height ?? null;
      const heightImperial = heightCm ? convertToImperial(heightCm) : null;
      const heightFt = formData.heightFt ?? heightImperial?.feet ?? null;
      const heightIn = formData.heightIn ?? heightImperial?.inches ?? null;
      const rawWeight = formData.weight ?? null; // in current unit
      const weightKg = rawWeight === null ? null : (useMetric ? rawWeight : convertWeight(rawWeight, true));
      const weightLbs = rawWeight === null ? null : (useMetric ? convertWeight(rawWeight, false) : rawWeight);
      // Persist normalized metric values in the numeric fields for consistency
      const persistedHeight = heightCm;
      const persistedWeight = weightKg;
      // Basic user data that can always be updated
      const baseUserData = {
        // Basic info
        name: formData.name || '',
        email: auth.currentUser?.email || '',
        username: formData.name || '',

        // Numeric values with defaults
        age: formData.age || null,
        height: persistedHeight,
        weight: persistedWeight,
        bodyFatPercentage: formData.bodyFatPercentage || null,
        // Unit metadata and denormalized mirrors
        unitSystem,
        heightCm,
        heightFt,
        heightIn,
        weightKg,
        weightLbs,

        // Goals and calculations from AI
        calorieGoal: aiResult?.calories || 2000,
        metabolism: aiResult?.metabolism || 2200,
        proteinGoal: aiResult?.protein || Math.round((aiResult?.calories || 2000) * 0.3 / 4),
        carbsGoal: aiResult?.carbs || Math.round((aiResult?.calories || 2000) * 0.4 / 4),
        fatGoal: aiResult?.fat || Math.round((aiResult?.calories || 2000) * 0.3 / 9),

        // New fields from enhanced onboarding
        birthMonth: formData.birthMonth || null,
        birthDay: formData.birthDay || null,
        birthYear: formData.birthYear || null,
        targetWeight: formData.targetWeight || null,
        weeklyGoal: formData.weeklyGoal || null,
        diet: formData.diet || null,
        regionPreference: formData.regionPreference || null,
        goal: formData.goal || null,
        goals: formData.goals || [],
        obstacles: formData.obstacles || [],
        source: formData.source || null,
        hasTriedOtherApps: formData.hasTriedOtherApps || "NO",

        // Enums and selections
        gender: formData.gender || null,
        activityLevel: formData.activityLevel || null,
        experienceLevel: formData.experienceLevel || 'BEGINNER',
        workoutDays: formData.workoutDays || null,

        // Arrays with empty defaults
        injuries: Array.isArray(formData.injuries) ? formData.injuries : [],
        allergies: Array.isArray(formData.allergies) ? formData.allergies : [],

        // Status and timestamps
        onboardingCompleted: true,
        lastUpdated: new Date().toISOString(),

        // Analytics & Stats
        streak: 0,
        lastLoginDate: new Date().toISOString(),
        totalMealsLogged: 0,
        totalWorkoutsLogged: 0,
        weeklyStats: {},
        monthlyStats: {},
        yearlyStats: {},

        // Preferences
        customTags: [],
        notificationsEnabled: true,
        theme: "dark",
        language: "en"
      };

      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          // For existing users, just update the base data
          // This avoids touching protected fields
          await updateDoc(userRef, baseUserData);
        } else {
          // For new users, include protected fields with default values
          await setDoc(userRef, {
            ...baseUserData,
            // Protected fields - only set during initial creation
            isPro: false,
            proExpiryDate: null,
            dailyImageAnalysis: 0,
            dailyMealAnalysis: 0,
            lastQuotaReset: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
        }

        // Update localStorage and store
        if (auth.currentUser?.email) {
          localStorage.setItem(`user_${auth.currentUser.email}`, JSON.stringify(baseUserData));
        }
        updateUser(baseUserData);

        // Navigate to home
        navigate('/home');
      } else {
        throw new Error('No authenticated user found');
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      toast.error(t('profile.saveFailed', { defaultValue: "We couldn't save your profile. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

  const getAiText = () => {
    switch (currentAiText) {
      case 0:
        return "Our AI has analyzed your information";
      case 1:
        return `Your metabolism is ${aiResult?.metabolism} cal`;
      case 2:
        return `Your recommended daily calorie intake is ${aiResult?.calories} cal`;
      default:
        return "";
    }
  };

  // Update conversion helpers to be more precise
  const convertToMetric = (ft: number, inches: number) => {
    const totalInches = (ft * 12) + (inches || 0);
    return Math.round(totalInches * 2.54);
  };

  const convertToImperial = (cm: number) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  };

  const convertWeight = (weight: number, toMetric: boolean) => {
    return toMetric ?
      Math.round(weight * 0.453592) :
      Math.round(weight / 0.453592);
  };

  // Local analysis helper (Mifflin-St Jeor BMR, TDEE, BMI, macros)
  const computeUserAnalysis = (data: Partial<UserProfile>, metric: boolean) => {
    // Resolve weight (kg)
    const weightKg = data.weight ? (metric ? data.weight : convertWeight(data.weight, true)) : 0;
    // Resolve height (cm)
    const heightCm = data.height
      ? (metric ? data.height : convertToMetric(data.heightFt as number, (data.heightIn || 0) as number))
      : 0;

    // Age from birth fields if present
    const getAge = () => {
      if (data.birthYear && data.birthMonth && data.birthDay) {
        const y = Number(data.birthYear);
        const m = Number(data.birthMonth) - 1;
        const d = Number(data.birthDay);
        const dob = new Date(y, m, d);
        if (!isNaN(dob.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const mdiff = today.getMonth() - dob.getMonth();
          if (mdiff < 0 || (mdiff === 0 && today.getDate() < dob.getDate())) age--;
          return Math.max(14, Math.min(90, age));
        }
      }
      return 30;
    };

    const age = getAge();
    const gender = (data.gender || 'male') as 'male' | 'female';

    // BMR (kcal) via Mifflin-St Jeor
    const bmr = gender === 'male'
      ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5
      : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;

    // Activity multiplier mapping
    const activityId = (data.activityLevel as string) || 'moderate';
    const activityMap: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
      veryActive: 1.9,
    };
    const multiplier = activityMap[activityId] || 1.55;

    // Goal adjustment to TDEE
    const tdee = bmr * multiplier;
    const goal = (data.goal as string) || 'maintain';
    let calories = tdee;
    if (goal === 'lose' || goal === 'lose_weight' || goal === 'fat_loss') calories = tdee * 0.85;
    if (goal === 'gain' || goal === 'muscle_gain') calories = tdee * 1.15;

    // Macros (simple defaults)
    const protein = Math.max(60, Math.round(1.8 * weightKg));
    const fat = Math.max(35, Math.round(0.8 * weightKg));
    const remaining = Math.max(0, Math.round(calories) - protein * 4 - fat * 9);
    const carbs = Math.max(0, Math.round(remaining / 4));

    // BMI
    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? +(weightKg / (heightM * heightM)).toFixed(1) : 0;

    return {
      metabolism: Math.round(bmr),
      calories: Math.round(calories),
      protein,
      carbs,
      fat,
      bmi,
    } as const;
  };

  // Add validation helper
  const isHeightValid = () => {
    if (useMetric) {
      return !!formData.height && formData.height >= 120 && formData.height <= 220;
    } else {
      const heightFt = formData.heightFt || 0;
      const heightIn = formData.heightIn || 0;
      return heightFt >= 4 && heightFt <= 7 && heightIn >= 0 && heightIn <= 11;
    }
  };

  const isWeightValid = () => {
    if (!formData.weight) return false;
    return useMetric ?
      formData.weight >= 30 && formData.weight <= 180 :
      formData.weight >= 66 && formData.weight <= 400;
  };

  // Update step validation
  const isStepValid = () => {
    if (step === steps.length - 2 && currentAiText < 3) return false;
    if (step === steps.findIndex(s => s.title === "Upgrade to DietinPro")) return true;

    switch (step) {
      case 1: // Name step
        return !!formData.name && formData.name.trim().length > 0 && isNameValid;
      case 2: // Birth date step
        return (formData.birthMonth !== undefined && formData.birthMonth !== null)
          && (formData.birthDay !== undefined && formData.birthDay !== null)
          && (formData.birthYear !== undefined && formData.birthYear !== null)
          && calculateAge(formData.birthYear, formData.birthMonth, formData.birthDay) >= 12;
      case 3: // Gender step
        return !!formData.gender;
      case 4: // Height & weight step
        return isHeightValid() && isWeightValid();
      case 5: // Current fitness level step
        return !!formData.experienceLevel;
      case 6: // Activity level step
        return !!formData.activityLevel;
      case 7: // Goal step
        return !!formData.goal;
      case 8: // Target weight step
        return !!formData.targetWeight &&
          formData.targetWeight >= (formData.weight * 0.7) &&
          formData.targetWeight <= (formData.weight * 1.3);
      case 9: // Weekly progress goal step
        return !!formData.weeklyGoal &&
          formData.weeklyGoal >= 0.2 &&
          formData.weeklyGoal <= 3.0;
      case 10: // Workout days step
        return !!formData.workoutDays;
      case 11: // Workout duration step
        return !!formData.workoutDuration;
      case 12: // Past obstacles step
        return !!formData.obstacles && formData.obstacles.length > 0;
      case 13: // Physical limitations step
        return true; // Optional step
      case 14: // Food allergies step
        return true; // Optional step
      case 15: // Regional food preference step
        return !!formData.regionPreference && formData.regionPreference.trim().length > 0;
      case 16: // DietinPro step
        return true; // Always valid
      case 17: // AI Analysis step
        return true; // Handled by AI analysis logic
      case 18: // Final summary step
        return true; // Always valid
      default:
        return true;
    }
  };

  // Add helper function for age calculation (monthIndex: 0-11)
  const calculateAge = (year: number, monthIndex: number, day: number) => {
    const birthDate = new Date(year, monthIndex, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const steps = [
    {
      title: "",
      description: "Let's create your personalized plan together",
      icon: Sparkles,
      fields: (
        <div>
          {/* Content removed - ready for new design */}
        </div>
      )
    },
    {
      title: t('welcome.name.title', "What's your name?"),
      description: t('welcome.name.desc', "Let's start with the basics"),
      icon: User,
      fields: (
        <div className="space-y-4">
          <input
            type="text"
            id="name"
            placeholder={t('welcome.name.placeholder', 'Enter your name')}
            className={inputClasses}
            inputMode="text"
            autoComplete="name"
            lang={i18n.language?.startsWith('ar') ? 'ar-EG' : undefined}
            dir={i18n.language?.startsWith('ar') ? 'rtl' : 'ltr'}
            value={formData.name || ''}
            onChange={(e) => {
              const newName = e.target.value;
              setIsNameValid(validateName(newName));
              updateForm({ name: newName });
            }}
          />
          {formData.name && !isNameValid && (
            <p className="text-red-500 text-sm">{t('welcome.name.error', 'Please enter a real name (letters only, 2-40 chars).')}</p>
          )}
        </div>
      )
    },
    {
      title: t('welcome.birth.title', 'When were you born?'),
      description: t('welcome.birth.desc', 'This will be used to calibrate your custom plan.'),
      fields: (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <select
              className={selectClasses}
              onChange={(e) => updateForm({ birthMonth: parseInt(e.target.value) })}
              value={(formData as any).birthMonth !== undefined ? String((formData as any).birthMonth) : ''}
            >
              <option value="">{t('welcome.birth.month', 'Month')}</option>
              {Array.from({ length: 12 }, (_, i) => i).map((i) => {
                const labels = [
                  t('welcome.birth.months.january', 'January'),
                  t('welcome.birth.months.february', 'February'),
                  t('welcome.birth.months.march', 'March'),
                  t('welcome.birth.months.april', 'April'),
                  t('welcome.birth.months.may', 'May'),
                  t('welcome.birth.months.june', 'June'),
                  t('welcome.birth.months.july', 'July'),
                  t('welcome.birth.months.august', 'August'),
                  t('welcome.birth.months.september', 'September'),
                  t('welcome.birth.months.october', 'October'),
                  t('welcome.birth.months.november', 'November'),
                  t('welcome.birth.months.december', 'December')
                ];
                const label = labels[i];
                return (
                  <option key={i} value={String(i)}>{label}</option>
                );
              })}
            </select>
            <select
              className={selectClasses}
              onChange={(e) => updateForm({ birthDay: parseInt(e.target.value) })}
              value={(formData as any).birthDay !== undefined ? String((formData as any).birthDay) : ''}
            >
              <option value="">{t('welcome.birth.day', 'Day')}</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={String(day)}>{day}</option>
              ))}
            </select>
            <select
              className={selectClasses}
              onChange={(e) => updateForm({ birthYear: parseInt(e.target.value) })}
              value={(formData as any).birthYear !== undefined ? String((formData as any).birthYear) : ''}
            >
              <option value="">{t('welcome.birth.year', 'Year')}</option>
              {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>
          {(formData as any).birthYear && (formData as any).birthMonth !== undefined && (formData as any).birthDay &&
            calculateAge((formData as any).birthYear, (formData as any).birthMonth, (formData as any).birthDay) < 12 && (
              <p className="text-red-500 text-sm mt-2">
                {t('welcome.birth.minAgeError', 'You must be at least 12 years old to use this app.')}
              </p>
            )}
        </div>
      )
    },
    {
      title: t('welcome.gender.title', 'Choose your gender'),
      description: t('welcome.gender.desc', 'This will be used to calibrate your custom plan.'),
      fields: (
        <div className="space-y-3">
          {['MALE', 'FEMALE'].map((gender) => (
            <button
              key={gender}
              onClick={() => updateForm({ gender: gender as Gender })}
              className={buttonClasses(formData.gender === gender)}
            >
              {gender === 'MALE'
                ? t('welcome.gender.options.male', 'Male')
                : t('welcome.gender.options.female', 'Female')}
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.hw.title', 'Height & weight'),
      description: t('welcome.hw.desc', 'This will be used to calibrate your custom plan.'),
      fields: (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <motion.span
              initial={false}
              animate={{ opacity: !useMetric ? 1 : 0.6 }}
              className={!useMetric ? "font-bold text-black" : "text-black/60"}
            >
              {t('welcome.hw.units.imperial', 'Imperial')}
            </motion.span>
            <motion.button
              role="switch"
              aria-checked={useMetric}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setUseMetric(prev => {
                  const newMetric = !prev;
                  // Convert existing values
                  if (formData.weight) {
                    const newWeight = convertWeight(formData.weight, newMetric);
                    updateForm({ weight: newWeight });
                  }
                  if (prev && formData.height) {
                    // Converting from metric to imperial
                    const { feet, inches } = convertToImperial(formData.height);
                    updateForm({
                      heightFt: feet,
                      heightIn: inches,
                      height: formData.height // Keep original cm value
                    });
                  } else if (!prev && formData.heightFt) {
                    // Converting from imperial to metric
                    const cm = convertToMetric(formData.heightFt, formData.heightIn || 0);
                    updateForm({ height: cm });
                  }
                  return newMetric;
                });
              }}
              className="w-12 h-6 rounded-full relative shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
              initial={false}
              animate={{ backgroundColor: useMetric ? '#e8f5e9' : '#e3f2fd' }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-black rounded-full"
                initial={false}
                animate={{ x: useMetric ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              />
            </motion.button>
            <motion.span
              initial={false}
              animate={{ opacity: useMetric ? 1 : 0.6 }}
              className={useMetric ? "font-bold text-black" : "text-black/60"}
            >
              {t('welcome.hw.units.metric', 'Metric')}
            </motion.span>
          </div>
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={useMetric ? "metric" : "imperial"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div>
                  <label className="block text-sm mb-2">{t('welcome.hw.height.label', 'Height')} {useMetric ? '(cm)' : ''}</label>
                  {useMetric ? (
                    <input
                      type="number"
                      placeholder={t('welcome.hw.height.placeholderCm', 'cm')}
                      className={cn(inputClasses, !isHeightValid() && formData.height && "ring-2 ring-red-500")}
                      value={formData.height || ''}
                      onChange={(e) => {
                        const cm = parseInt(e.target.value);
                        updateForm({ height: cm });
                      }}
                      min={120}
                      max={220}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="number"
                        placeholder={t('welcome.hw.height.placeholderFt', 'ft')}
                        className={cn(inputClasses, !isHeightValid() && formData.heightFt && "ring-2 ring-red-500")}
                        value={formData.heightFt || ''}
                        onChange={(e) => {
                          const ft = parseInt(e.target.value);
                          const inches = formData.heightIn || 0;
                          updateForm({
                            heightFt: ft,
                            height: convertToMetric(ft, inches)
                          });
                        }}
                        min={4}
                        max={7}
                      />
                      <input
                        type="number"
                        placeholder={t('welcome.hw.height.placeholderIn', 'in')}
                        className={cn(inputClasses, !isHeightValid() && formData.heightIn && "ring-2 ring-red-500")}
                        value={formData.heightIn || ''}
                        onChange={(e) => {
                          const inches = parseInt(e.target.value);
                          const ft = formData.heightFt || 0;
                          updateForm({
                            heightIn: inches,
                            height: convertToMetric(ft, inches)
                          });
                        }}
                        min={0}
                        max={11}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.div
                key={useMetric ? "metric-weight" : "imperial-weight"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div>
                  <label className="block text-sm mb-2">{t('welcome.hw.weight.label', 'Weight')} {useMetric ? '(kg)' : '(lbs)'}</label>
                  <input
                    type="number"
                    className={cn(inputClasses, !isWeightValid() && formData.weight && "ring-2 ring-red-500")}
                    value={formData.weight || ''}
                    onChange={(e) => updateForm({ weight: parseInt(e.target.value) })}
                    min={useMetric ? 30 : 66}
                    max={useMetric ? 180 : 400}
                    placeholder={useMetric ? t('welcome.hw.weight.placeholderKg', 'kg') : t('welcome.hw.weight.placeholderLbs', 'lbs')}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
            {/* Validation Messages */}
            <AnimatePresence>
              {!isHeightValid() && (formData.height || formData.heightFt) && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-sm"
                >
                  {useMetric ?
                    t('welcome.hw.validation.heightMetric', 'Height must be between 120cm and 220cm') :
                    t('welcome.hw.validation.heightImperial', 'Height must be between 4\'0" and 7\'11"')
                  }
                </motion.p>
              )}
              {!isWeightValid() && formData.weight && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-sm"
                >
                  {useMetric ?
                    t('welcome.hw.validation.weightMetric', 'Weight must be between 30kg and 180kg') :
                    t('welcome.hw.validation.weightImperial', 'Weight must be between 66lbs and 400lbs')
                  }
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      )
    },
    {
      title: t('welcome.fitness.title', "What's your current fitness level?"),
      description: t('welcome.fitness.desc', 'This helps us tailor the program to your experience'),
      fields: (
        <div className="space-y-3">
          {[
            { id: 'BEGINNER', label: t('welcome.fitness.options.beginner.label', 'Beginner'), desc: t('welcome.fitness.options.beginner.desc', 'New to fitness or getting back after a long break') },
            { id: 'INTERMEDIATE', label: t('welcome.fitness.options.intermediate.label', 'Intermediate'), desc: t('welcome.fitness.options.intermediate.desc', 'Regular exercise with some experience') },
            { id: 'ADVANCED', label: t('welcome.fitness.options.advanced.label', 'Advanced'), desc: t('welcome.fitness.options.advanced.desc', 'Experienced with consistent training') }
          ].map((level) => (
            <button
              key={level.id}
              onClick={() => updateForm({ experienceLevel: level.id as ExperienceLevel })}
              className={buttonClasses(formData.experienceLevel === level.id)}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-bold">{level.label}</div>
                  <div className="text-sm text-black/60">{level.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.activity.title', "What's your activity level?"),
      description: t('welcome.activity.desc', 'This helps us calculate your daily energy needs'),
      fields: (
        <div className="space-y-3">
          {[
            { id: 'LIGHTLY_ACTIVE', label: t('welcome.activity.options.lightlyActive.label', 'Lightly Active'), desc: t('welcome.activity.options.lightlyActive.desc', 'Mostly sedentary with light exercise') },
            { id: 'MODERATELY_ACTIVE', label: t('welcome.activity.options.moderatelyActive.label', 'Moderately Active'), desc: t('welcome.activity.options.moderatelyActive.desc', 'Regular exercise or active job') },
            { id: 'VERY_ACTIVE', label: t('welcome.activity.options.veryActive.label', 'Very Active'), desc: t('welcome.activity.options.veryActive.desc', 'Daily exercise or physically demanding job') },
            { id: 'EXTRA_ACTIVE', label: t('welcome.activity.options.extraActive.label', 'Extra Active'), desc: t('welcome.activity.options.extraActive.desc', 'Multiple training sessions or athlete') }
          ].map((level) => (
            <button
              key={level.id}
              onClick={() => updateForm({ activityLevel: level.id as ActivityLevel })}
              className={buttonClasses(formData.activityLevel === level.id)}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-bold">{level.label}</div>
                  <div className="text-sm text-black/60">{level.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.goal.title', 'What is your goal?'),
      description: t('welcome.goal.desc', 'This helps us generate a plan for your calorie intake.'),
      fields: (
        <div className="space-y-3">
          {[
            {
              id: 'LOSE_WEIGHT',
              label: t('welcome.goal.options.loseWeight.label', 'Lose weight'),
              desc: t('welcome.goal.options.loseWeight.desc', 'Focus on reducing overall body weight'),
              icon: Scale
            },
            {
              id: 'LOSE_FAT',
              label: t('welcome.goal.options.loseFat.label', 'Lose fat and maintain muscle'),
              desc: t('welcome.goal.options.loseFat.desc', 'Focus on fat loss while preserving muscle mass'),
              icon: Target
            },
            {
              id: 'RECOMPOSITION',
              label: t('welcome.goal.options.recomposition.label', 'Lose fat and gain muscle'),
              desc: t('welcome.goal.options.recomposition.desc', 'Body recomposition - simultaneously reduce fat and build muscle'),
              icon: Dumbbell
            },
            {
              id: 'MAINTAIN_HEALTH',
              label: t('welcome.goal.options.maintainHealth.label', 'Maintain and improve health'),
              desc: t('welcome.goal.options.maintainHealth.desc', 'Focus on overall health and wellness while maintaining weight'),
              icon: Heart
            },
            {
              id: 'MAINTAIN_ATHLETIC',
              label: t('welcome.goal.options.maintainAthletic.label', 'Maintain athletic performance'),
              desc: t('welcome.goal.options.maintainAthletic.desc', 'Maintain weight while optimizing for athletic performance'),
              icon: Activity
            },
            {
              id: 'GAIN_MUSCLE',
              label: t('welcome.goal.options.gainMuscle.label', 'Gain muscle'),
              desc: t('welcome.goal.options.gainMuscle.desc', 'Focus on building muscle mass with minimal fat gain'),
              icon: Dumbbell
            },
            {
              id: 'GAIN_WEIGHT',
              label: t('welcome.goal.options.gainWeight.label', 'Gain weight'),
              desc: t('welcome.goal.options.gainWeight.desc', 'Focus on increasing overall body weight'),
              icon: LineChart
            }
          ].map((goal) => (
            <button
              key={goal.id}
              onClick={() => updateForm({ goal: goal.id as Goal })}
              className={buttonClasses(formData.goal === goal.id)}
            >
              <div className="flex items-center gap-3 px-2">
                <goal.icon className="w-6 h-6 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-bold">{goal.label}</div>
                  <div className={cn(
                    "text-sm",
                    formData.goal === goal.id ? "text-white/90" : "text-black/60"
                  )}>{goal.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.targetWeight.title', 'What is your desired weight?'),
      description: "",
      fields: (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2 text-black">
              {formData.goal === 'LOSE_WEIGHT'
                ? t('welcome.targetWeight.headings.default', 'Target Weight')
                : formData.goal === 'GAIN_WEIGHT'
                  ? t('welcome.targetWeight.headings.default', 'Target Weight')
                  : formData.goal === 'LOSE_FAT'
                    ? t('welcome.targetWeight.headings.preserveMuscle', 'Target Weight While Preserving Muscle')
                    : formData.goal === 'GAIN_MUSCLE'
                      ? t('welcome.targetWeight.headings.muscleGain', 'Target Weight With Muscle Gain')
                      : formData.goal === 'RECOMPOSITION'
                        ? t('welcome.targetWeight.headings.recomposition', 'Target Weight With Body Recomposition')
                        : t('welcome.targetWeight.headings.default', 'Target Weight')}
            </h3>

            <div className="mt-8 mb-12 relative">
              <div className="text-6xl font-bold tracking-tight">
                {formData.targetWeight || formData.weight}
                <span className="text-2xl ml-2 text-white/60 font-medium">
                  {useMetric ? 'kg' : 'lbs'}
                </span>
              </div>

              <div className="text-sm text-white/60 mt-2">
                {useMetric
                  ? `${Math.round((formData.targetWeight || formData.weight) * 2.20462)} ${t('welcome.targetWeight.unitLbs', 'lbs')}`
                  : `${Math.round((formData.targetWeight || formData.weight) * 0.453592)} ${t('welcome.targetWeight.unitKg', 'kg')}`}
              </div>
            </div>

            <div className="space-y-8">
              <div className="relative px-1">
                <input
                  type="range"
                  min={useMetric ? formData.weight * 0.7 : Math.round(formData.weight * 0.7)}
                  max={useMetric ? formData.weight * 1.3 : Math.round(formData.weight * 1.3)}
                  step={useMetric ? 0.1 : 1}
                  value={formData.targetWeight || formData.weight}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    updateForm({ targetWeight: value });
                  }}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black
                    [&::-webkit-slider-thumb]:w-8 
                    [&::-webkit-slider-thumb]:h-8 
                    [&::-webkit-slider-thumb]:bg-black 
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:border-4
                    [&::-webkit-slider-thumb]:border-white
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:transition-all
                    [&::-webkit-slider-thumb]:duration-150
                    [&::-webkit-slider-thumb]:ease-in-out
                    [&::-webkit-slider-thumb:hover]:border-2
                    [&::-webkit-slider-thumb:active]:scale-110"
                />

                <div className="flex justify-between text-xs text-white/60 mt-2 px-2">
                  <span>
                    {useMetric
                      ? `${Math.round(formData.weight * 0.7)} ${t('welcome.targetWeight.unitKg', 'kg')}`
                      : `${Math.round(formData.weight * 0.7)} ${t('welcome.targetWeight.unitLbs', 'lbs')}`}
                  </span>
                  <span>{t('welcome.targetWeight.current', 'Current')}</span>
                  <span>
                    {useMetric
                      ? `${Math.round(formData.weight * 1.3)} ${t('welcome.targetWeight.unitKg', 'kg')}`
                      : `${Math.round(formData.weight * 1.3)} ${t('welcome.targetWeight.unitLbs', 'lbs')}`}
                  </span>
                </div>
              </div>

              <div className="bg-[#F5F5F5] rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl">
                    {formData.goal === 'LOSE_WEIGHT' || formData.goal === 'LOSE_FAT' ? '⬇️' :
                      formData.goal === 'GAIN_WEIGHT' || formData.goal === 'GAIN_MUSCLE' ? '⬆️' :
                        formData.goal === 'RECOMPOSITION' ? '🔄' : '⚖️'}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">
                      {formData.goal === 'LOSE_WEIGHT' || formData.goal === 'LOSE_FAT'
                        ? `${useMetric
                          ? Math.abs(Math.round((formData.targetWeight || formData.weight) - formData.weight))
                          : Math.abs(Math.round((formData.targetWeight || formData.weight) - formData.weight))} ${useMetric ? t('welcome.targetWeight.unitKg', 'kg') : t('welcome.targetWeight.unitLbs', 'lbs')} ${t('welcome.targetWeight.toTarget', 'to reach target')}`
                        : formData.goal === 'GAIN_WEIGHT' || formData.goal === 'GAIN_MUSCLE'
                          ? `${useMetric
                            ? Math.abs(Math.round((formData.targetWeight || formData.weight) - formData.weight))
                            : Math.abs(Math.round((formData.targetWeight || formData.weight) - formData.weight))} ${useMetric ? t('welcome.targetWeight.unitKg', 'kg') : t('welcome.targetWeight.unitLbs', 'lbs')} ${t('welcome.targetWeight.toGain', 'to gain')}`
                          : formData.goal === 'RECOMPOSITION'
                            ? t('welcome.targetWeight.focusRecomp', 'Focus on body composition change')
                            : t('welcome.targetWeight.maintain', 'Maintain current weight')}
                    </p>
                    <button
                      onClick={() => {
                        // Compute recommended target using deterministic BMI-based calculator (no AI)
                        const current = Number(formData.weight) || 0;
                        const heightCm = formData.height ?? null;
                        let next = computeRecommendedTargetWeight(current, heightCm, formData.goal as Goal, useMetric);
                        // Clamp within slider bounds
                        const min = useMetric ? current * 0.7 : Math.round(current * 0.7);
                        const max = useMetric ? current * 1.3 : Math.round(current * 1.3);
                        next = Math.min(Math.max(next, min), max);
                        // Final guard to ensure not equal to current
                        const MIN_DELTA = useMetric ? 0.5 : 1;
                        if (Math.abs(next - current) < (useMetric ? 0.0001 : 0.0001)) {
                          next = (formData.goal === 'LOSE_WEIGHT' || formData.goal === 'LOSE_FAT') ? current - MIN_DELTA : current + MIN_DELTA;
                        }
                        // Round to UI step
                        next = useMetric ? Math.round(next * 10) / 10 : Math.round(next);
                        updateForm({ targetWeight: next });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors mt-1"
                    >
                      {t('welcome.targetWeight.setRecommended', 'Set to recommended target')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: t('welcome.weeklyGoal.title', 'How fast do you want to reach your goal?'),
      description: "",
      fields: (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2 text-black">{t('welcome.weeklyGoal.subtitle', 'Weekly Progress Goal')}</h3>
            <div className="text-6xl font-bold my-8 text-black">
              {formData.weeklyGoal || 1.0}
              <span className="text-2xl ml-2 text-black/60 font-medium">
                {useMetric ? 'kg' : 'lbs'}
              </span>
            </div>
            <div className="relative px-1">
              <input
                type="range"
                min={useMetric ? 0.1 : 0.2}
                max={useMetric ? 1.4 : 3.0}
                step={useMetric ? 0.05 : 0.1}
                value={formData.weeklyGoal || 1.0}
                onChange={(e) => updateForm({ weeklyGoal: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black
                  [&::-webkit-slider-thumb]:w-8 
                  [&::-webkit-slider-thumb]:h-8 
                  [&::-webkit-slider-thumb]:bg-black 
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:border-4
                  [&::-webkit-slider-thumb]:border-white
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:transition-all
                  [&::-webkit-slider-thumb]:duration-150
                  [&::-webkit-slider-thumb]:ease-in-out
                  [&::-webkit-slider-thumb:hover]:border-2
                  [&::-webkit-slider-thumb:active]:scale-110"
              />
              <div className="flex justify-between text-sm mt-4 px-2">
                <div className="text-center">
                  <span className="text-black/60">{t('welcome.weeklyGoal.labels.steady', 'Steady')}</span>
                </div>
                <div className="text-center">
                  <span className="text-black/60">{t('welcome.weeklyGoal.labels.balanced', 'Balanced')}</span>
                </div>
                <div className="text-center">
                  <span className="text-black/60">{t('welcome.weeklyGoal.labels.ambitious', 'Ambitious')}</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={() => {
                  let recommendedGoal;
                  if (formData.goal === 'LOSE_WEIGHT' || formData.goal === 'LOSE_FAT') {
                    recommendedGoal = useMetric ? 0.5 : 1.0;
                  } else if (formData.goal === 'GAIN_WEIGHT' || formData.goal === 'GAIN_MUSCLE') {
                    recommendedGoal = useMetric ? 0.25 : 0.5;
                  } else {
                    recommendedGoal = useMetric ? 0.35 : 0.75;
                  }
                  updateForm({ weeklyGoal: recommendedGoal });
                }}
                className="bg-white w-full rounded-2xl py-4 px-6 flex items-center justify-between group hover:bg-[#EBEBEB] transition-colors shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-black/5 rounded-xl">
                    ⚡️
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-black">{t('welcome.weeklyGoal.recommended.title', 'Recommended for your goal')}</p>
                    <p className="text-sm text-black/60">{t('welcome.weeklyGoal.recommended.desc', 'Based on sustainable progress')}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )
    },
    {
      title: t('welcome.workoutDays.title', 'How many workouts do you do per week?'),
      description: t('welcome.workoutDays.desc', 'This will be used to calibrate your custom plan.'),
      fields: (
        <div className="space-y-3">
          {[
            { id: '0-2', label: t('welcome.workoutDays.options.0_2.label', '0-2'), desc: t('welcome.workoutDays.options.0_2.desc', 'Workouts now and then') },
            { id: '3-5', label: t('welcome.workoutDays.options.3_5.label', '3-5'), desc: t('welcome.workoutDays.options.3_5.desc', 'A few workouts per week') },
            { id: '6+', label: t('welcome.workoutDays.options.6_plus.label', '6+'), desc: t('welcome.workoutDays.options.6_plus.desc', 'Dedicated athlete') }
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => updateForm({ workoutDays: option.id })}
              className={buttonClasses(formData.workoutDays === option.id)}
            >
              <div className="flex items-center">
                <div className="flex-1 text-left">
                  <div className="font-bold text-black">{option.label}</div>
                  <div className="text-sm text-black/60">{option.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.workoutDuration.title', 'How long do you prefer to workout?'),
      description: t('welcome.workoutDuration.desc', 'Choose your ideal workout duration'),
      fields: (
        <div className="space-y-3">
          {[
            { id: '30', label: t('welcome.workoutDuration.options.m30.label', '30 minutes'), desc: t('welcome.workoutDuration.options.m30.desc', 'Quick and effective workouts') },
            { id: '45', label: t('welcome.workoutDuration.options.m45.label', '45 minutes'), desc: t('welcome.workoutDuration.options.m45.desc', 'Balanced workout duration') },
            { id: '60', label: t('welcome.workoutDuration.options.m60.label', '60 minutes'), desc: t('welcome.workoutDuration.options.m60.desc', 'Full comprehensive sessions') },
            { id: '90', label: t('welcome.workoutDuration.options.m90.label', '90+ minutes'), desc: t('welcome.workoutDuration.options.m90.desc', 'Extended training sessions') }
          ].map((duration) => (
            <button
              key={duration.id}
              onClick={() => updateForm({ workoutDuration: duration.id })}
              className={buttonClasses(formData.workoutDuration === duration.id)}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-bold">{duration.label}</div>
                  <div className="text-sm text-black/60">{duration.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.obstacles.title', 'What obstacles have prevented your success?'),
      description: t('welcome.obstacles.desc', 'Select all that apply'),
      fields: (
        <div className="space-y-3">
          {[
            { id: 'TIME', label: t('welcome.obstacles.options.TIME.label', 'Lack of time'), desc: t('welcome.obstacles.options.TIME.desc', 'Busy schedule makes it hard to stay consistent') },
            { id: 'MOTIVATION', label: t('welcome.obstacles.options.MOTIVATION.label', 'Low motivation'), desc: t('welcome.obstacles.options.MOTIVATION.desc', 'Difficulty staying motivated') },
            { id: 'KNOWLEDGE', label: t('welcome.obstacles.options.KNOWLEDGE.label', 'Limited knowledge'), desc: t('welcome.obstacles.options.KNOWLEDGE.desc', 'Unsure about proper form or nutrition') },
            { id: 'INJURIES', label: t('welcome.obstacles.options.INJURIES.label', 'Past injuries'), desc: t('welcome.obstacles.options.INJURIES.desc', 'Physical limitations or concerns') },
            { id: 'STRESS', label: t('welcome.obstacles.options.STRESS.label', 'High stress'), desc: t('welcome.obstacles.options.STRESS.desc', 'Work or life stress affects consistency') },
            { id: 'SLEEP', label: t('welcome.obstacles.options.SLEEP.label', 'Poor sleep'), desc: t('welcome.obstacles.options.SLEEP.desc', 'Inadequate rest affects performance') },
            { id: 'NUTRITION', label: t('welcome.obstacles.options.NUTRITION.label', 'Diet challenges'), desc: t('welcome.obstacles.options.NUTRITION.desc', 'Difficulty maintaining healthy eating') }
          ].map((obstacle) => (
            <button
              key={obstacle.id}
              onClick={() => {
                const current = formData.obstacles || [];
                const updated = current.includes(obstacle.id)
                  ? current.filter(id => id !== obstacle.id)
                  : [...current, obstacle.id];
                updateForm({ obstacles: updated });
              }}
              className={buttonClasses((formData.obstacles || []).includes(obstacle.id))}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-bold">{obstacle.label}</div>
                  <div className="text-sm text-black/60">{obstacle.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.limitations.title', 'Do you have any physical limitations?'),
      description: t('welcome.limitations.desc', 'Select all that apply to receive modified exercises'),
      fields: (
        <div className="space-y-3">
          {[
            { id: 'BACK', label: t('welcome.limitations.options.BACK.label', 'Back issues'), desc: t('welcome.limitations.options.BACK.desc', 'Lower or upper back pain/injury') },
            { id: 'KNEE', label: t('welcome.limitations.options.KNEE.label', 'Knee problems'), desc: t('welcome.limitations.options.KNEE.desc', 'Joint pain or previous injury') },
            { id: 'SHOULDER', label: t('welcome.limitations.options.SHOULDER.label', 'Shoulder limitations'), desc: t('welcome.limitations.options.SHOULDER.desc', 'Restricted movement or pain') },
            { id: 'WRIST', label: t('welcome.limitations.options.WRIST.label', 'Wrist/hand issues'), desc: t('welcome.limitations.options.WRIST.desc', 'Carpal tunnel or joint pain') },
            { id: 'HIP', label: t('welcome.limitations.options.HIP.label', 'Hip problems'), desc: t('welcome.limitations.options.HIP.desc', 'Limited mobility or discomfort') },
            { id: 'NONE', label: t('welcome.limitations.options.NONE.label', 'No limitations'), desc: t('welcome.limitations.options.NONE.desc', 'No physical restrictions') }
          ].map((limitation) => (
            <button
              key={limitation.id}
              onClick={() => {
                if (limitation.id === 'NONE') {
                  updateForm({ injuries: [] });
                } else {
                  const current = formData.injuries || [];
                  const updated = current.includes(limitation.id)
                    ? current.filter(id => id !== limitation.id)
                    : [...current, limitation.id];
                  updateForm({ injuries: updated });
                }
              }}
              className={buttonClasses(
                limitation.id === 'NONE'
                  ? (formData.injuries || []).length === 0
                  : (formData.injuries || []).includes(limitation.id)
              )}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-bold">{limitation.label}</div>
                  <div className="text-sm text-black/60">{limitation.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.allergies.title', 'Do you have any food allergies?'),
      description: t('welcome.allergies.desc', 'Select all that apply to receive safe meal suggestions'),
      fields: (
        <div className="space-y-3">
          {[
            { id: 'DAIRY', label: t('welcome.allergies.options.DAIRY.label', 'Dairy'), desc: t('welcome.allergies.options.DAIRY.desc', 'Milk, cheese, yogurt') },
            { id: 'NUTS', label: t('welcome.allergies.options.NUTS.label', 'Tree nuts'), desc: t('welcome.allergies.options.NUTS.desc', 'Almonds, walnuts, cashews') },
            { id: 'PEANUT', label: t('welcome.allergies.options.PEANUT.label', 'Peanuts'), desc: t('welcome.allergies.options.PEANUT.desc', 'Peanuts and peanut products') },
            { id: 'GLUTEN', label: t('welcome.allergies.options.GLUTEN.label', 'Gluten'), desc: t('welcome.allergies.options.GLUTEN.desc', 'Wheat, barley, rye') },
            { id: 'SOY', label: t('welcome.allergies.options.SOY.label', 'Soy'), desc: t('welcome.allergies.options.SOY.desc', 'Soybeans and soy products') },
            { id: 'SHELLFISH', label: t('welcome.allergies.options.SHELLFISH.label', 'Shellfish'), desc: t('welcome.allergies.options.SHELLFISH.desc', 'Shrimp, crab, lobster') },
            { id: 'EGGS', label: t('welcome.allergies.options.EGGS.label', 'Eggs'), desc: t('welcome.allergies.options.EGGS.desc', 'Eggs and egg products') },
            { id: 'NONE', label: t('welcome.allergies.options.NONE.label', 'No allergies'), desc: t('welcome.allergies.options.NONE.desc', 'No food restrictions') }
          ].map((allergy) => (
            <button
              key={allergy.id}
              onClick={() => {
                if (allergy.id === 'NONE') {
                  updateForm({ allergies: [] });
                } else {
                  const current = formData.allergies || [];
                  const updated = current.includes(allergy.id)
                    ? current.filter(id => id !== allergy.id)
                    : [...current, allergy.id];
                  updateForm({ allergies: updated });
                }
              }}
              className={buttonClasses(
                allergy.id === 'NONE'
                  ? (formData.allergies || []).length === 0
                  : (formData.allergies || []).includes(allergy.id)
              )}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-bold">{allergy.label}</div>
                  <div className="text-sm text-black/60">{allergy.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: t('welcome.cuisines.title', 'What regional cuisines do you prefer?'),
      description: t('welcome.cuisines.desc', "We'll bias meal ideas toward this preference"),
      fields: (
        <div className="space-y-3">
          <div className="grid gap-3">
            {[
              { label: t('welcome.cuisines.options.mediterranean', 'Mediterranean'), emoji: '🫒' },
              { label: t('welcome.cuisines.options.indian', 'Indian'), emoji: '🍛' },
              { label: t('welcome.cuisines.options.mexican', 'Mexican'), emoji: '🌮' },
              { label: t('welcome.cuisines.options.eastAsian', 'East Asian'), emoji: '🥢' },
              { label: t('welcome.cuisines.options.middleEastern', 'Middle Eastern'), emoji: '🥙' },
              { label: t('welcome.cuisines.options.american', 'American'), emoji: '🍔' },
              { label: t('welcome.cuisines.options.african', 'African'), emoji: '🍲' },
              { label: t('welcome.cuisines.options.latinAmerican', 'Latin American'), emoji: '🥟' },
              { label: t('welcome.cuisines.options.southeastAsian', 'Southeast Asian'), emoji: '🍜' },
              { label: t('welcome.cuisines.options.european', 'European'), emoji: '🥖' }
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => { setCustomRegionActive(false); updateForm({ regionPreference: opt.label }); }}
                className={buttonClasses(formData.regionPreference === opt.label)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden>{opt.emoji}</span>
                  <div className="text-left font-bold">{opt.label}</div>
                </div>
              </button>
            ))}
            <button
              onClick={() => { setCustomRegionActive(false); updateForm({ regionPreference: 'None' }); }}
              className={buttonClasses(formData.regionPreference === 'None')}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden>🎯</span>
                <div className="text-left">
                  <div className="font-bold">{t('welcome.cuisines.none.title', 'No strong preference')}</div>
                  <div className="text-sm text-black/60">{t('welcome.cuisines.none.subtitle', 'Show a broad variety')}</div>
                </div>
              </div>
            </button>
          </div>
          <div className="pt-2">
            <input
              type="text"
              value={customRegionActive ? customRegion : ''}
              onFocus={() => setCustomRegionActive(true)}
              onChange={(e) => { setCustomRegion(e.target.value); updateForm({ regionPreference: e.target.value }); }}
              placeholder={t('welcome.cuisines.custom.placeholder', 'Or type a region/cuisine (e.g., Japanese, Italian)')}
              className={cn(inputClasses, 'bg-white text-black opacity-100 pointer-events-auto')}
              aria-label={t('welcome.cuisines.custom.aria', 'Custom regional cuisine preference')}
            />
          </div>
        </div>
      )
    },
    {
      title: t('welcome.pro.title', 'Upgrade to DietinPro'),
      description: t('welcome.pro.desc', 'Experience fitness at its finest'),
      fields: (
        <div className="space-y-6">
          {/* Premium Features */}
          <div className="grid gap-4">
            {[
              {
                id: 'AI_COACH',
                label: t('welcome.pro.features.aiCoach.label', 'AI Nutrition Coach'),
                desc: t('welcome.pro.features.aiCoach.desc', 'Get personalized meal plans and real-time guidance'),
                icon: Bot,
                highlight: t('welcome.pro.features.aiCoach.highlight', 'Most Popular')
              },
              {
                id: 'PREMIUM_RECIPES',
                label: t('welcome.pro.features.premiumRecipes.label', 'Premium Recipes'),
                desc: t('welcome.pro.features.premiumRecipes.desc', 'Access exclusive healthy and delicious recipes'),
                icon: Apple,
                highlight: t('welcome.pro.features.premiumRecipes.highlight', 'New')
              },
              {
                id: 'ADVANCED_TRACKING',
                label: t('welcome.pro.features.advancedAnalytics.label', 'Advanced Analytics'),
                desc: t('welcome.pro.features.advancedAnalytics.desc', 'Detailed insights and progress tracking'),
                icon: LineChart,
                highlight: t('welcome.pro.features.advancedAnalytics.highlight', 'Pro')
              },
              {
                id: 'MEAL_PLANNER',
                label: t('welcome.pro.features.mealPlanner.label', 'Smart Meal Planner'),
                desc: t('welcome.pro.features.mealPlanner.desc', 'AI-powered meal planning and optimization'),
                icon: Calendar,
                highlight: t('welcome.pro.features.mealPlanner.highlight', 'Premium')
              }
            ].map((feature) => (
              <div
                key={feature.id}
                className="group relative w-full px-6 py-5 rounded-2xl bg-white text-black shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer border border-black/5"
              >
                <div className="absolute -top-2 -right-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-black to-gray-700 text-white">
                    {feature.highlight}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-black/5">
                    <feature.icon className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-black group-hover:text-black/80 transition-colors">{feature.label}</h3>
                    <p className="text-sm text-black/60 group-hover:text-black/70 transition-colors">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Premium Pricing Card */}
          <div className="mt-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] p-8 shadow-2xl">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 opacity-20 blur-2xl"></div>

              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{t('welcome.pro.card.title', 'DietinPro')}</h3>
                    <p className="text-sm text-white/60">{t('welcome.pro.card.subtitle', 'Unlock your full potential')}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-3xl font-bold text-white">$8.99</span>
                      <span className="text-sm text-white/60">{t('welcome.pro.card.perMonth', '/month')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {[
                    t('welcome.pro.card.benefits.aiAnalysis', '✨ Unlimited AI meal analysis'),
                    t('welcome.pro.card.benefits.workoutPlans', '🎯 Personalized workout plans'),
                    t('welcome.pro.card.benefits.premiumAccess', '🔒 Premium features access'),
                    t('welcome.pro.card.benefits.nutritionGuidance', '💪 Expert nutrition guidance')
                  ].map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3 text-white/80">
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setIsProPanelOpen(true);
                  }}
                  className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white px-6 py-4 rounded-xl font-semibold hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t('welcome.pro.card.cta', 'Get Started with Pro')}
                </button>

                <p className="text-xs text-center text-white/40 mt-4">
                  {t('welcome.pro.card.noRefund', 'No refund')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: t('welcome.aiAnalysis.title', 'AI Analysis'),
      description: t('welcome.aiAnalysis.desc', 'Our AI is analyzing your profile'),
      fields: (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
          <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin" />
          <p className="text-lg font-medium text-black">{t('welcome.aiAnalysis.loading', 'Analyzing your profile...')}</p>
        </div>
      )
    },
    {
      title: t('welcome.ready.title', 'Ready to Begin'),
      description: t('welcome.ready.desc', "Let's start your fitness journey"),
      fields: (
        <div className="space-y-8">
          {/* AI Analysis Results */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <p className="text-sm text-black/60 mb-2">{t('welcome.ready.metrics.metabolism', 'Your Metabolism')}</p>
              <p className="text-2xl font-bold text-black">{aiResult?.metabolism} cal</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <p className="text-sm text-black/60 mb-2">{t('welcome.ready.metrics.calories', 'Daily Calories')}</p>
              <p className="text-2xl font-bold text-black">{aiResult?.calories} cal</p>
            </div>
          </div>

          {/* Macronutrients */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  🥩
                </div>
                <div>
                  <p className="text-sm text-black/60">{t('welcome.ready.macros.protein', 'Protein')}</p>
                  <p className="text-xl font-bold text-black">{aiResult?.protein}g</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  🌾
                </div>
                <div>
                  <p className="text-sm text-black/60">{t('welcome.ready.macros.carbs', 'Carbs')}</p>
                  <p className="text-xl font-bold text-black">{aiResult?.carbs}g</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  🥑
                </div>
                <div>
                  <p className="text-sm text-black/60">{t('welcome.ready.macros.fat', 'Fat')}</p>
                  <p className="text-xl font-bold text-black">{aiResult?.fat}g</p>
                </div>
              </div>
            </div>
          </div>

          {/* Weight Progress Chart */}
          <div className="bg-white rounded-2xl p-6 space-y-4 shadow-md">
            <h4 className="font-bold text-lg text-black">{t('welcome.ready.chart.title', 'Estimated Progress Timeline')}</h4>
            <div className="relative h-[200px]">
              <Line
                data={{
                  labels: Array.from({ length: 12 }, (_, i) => t('welcome.ready.chart.weekLabel', 'Week {{num}}', { num: i + 1 })),
                  datasets: [
                    {
                      label: t('welcome.ready.chart.withDietin', 'With Dietin'),
                      data: Array.from({ length: 12 }, (_, i) => {
                        const weeklyChange = formData.weeklyGoal || 0;
                        const direction = formData.targetWeight < formData.weight ? -1 : 1;
                        return formData.weight + (weeklyChange * direction * (i + 1));
                      }),
                      borderColor: 'rgba(37, 99, 235, 1)',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      fill: true,
                      tension: 0.4
                    },
                    {
                      label: t('welcome.ready.chart.withoutGuidance', 'Without Guidance'),
                      data: Array.from({ length: 12 }, (_, i) => {
                        const weeklyChange = (formData.weeklyGoal || 0) * 0.4;
                        const direction = formData.targetWeight < formData.weight ? -1 : 1;
                        const progress = formData.weight + (weeklyChange * direction * (i + 1));
                        // Add some fluctuation
                        return progress + (Math.sin(i) * weeklyChange * 2);
                      }),
                      borderColor: 'rgba(156, 163, 175, 1)',
                      backgroundColor: 'rgba(156, 163, 175, 0.1)',
                      borderDash: [5, 5],
                      fill: true,
                      tension: 0.2
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                      labels: {
                        boxWidth: 10,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: 'rgba(0, 0, 0, 0.8)'
                      }
                    }
                  },
                  scales: {
                    y: {
                      title: {
                        display: true,
                        text: useMetric ? t('welcome.ready.chart.weightKg', 'Weight (kg)') : t('welcome.ready.chart.weightLbs', 'Weight (lbs)'),
                        color: 'rgba(0, 0, 0, 0.8)'
                      },
                      ticks: {
                        callback: (value) => `${Math.round(value as number)}`,
                        color: 'rgba(0, 0, 0, 0.6)'
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                      }
                    },
                    x: {
                      ticks: {
                        color: 'rgba(0, 0, 0, 0.6)'
                      },
                      grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                      }
                    }
                  }
                }}
              />
            </div>
            <div className="text-sm text-black/60 mt-2">
              {t('welcome.ready.chart.note', 'Projected timeline based on your goals and commitment')}
            </div>
          </div>

          {/* AI Goals Summary */}
          <div className="bg-white rounded-2xl p-6 space-y-4 shadow-md">
            <h4 className="font-bold text-lg text-black">{t('welcome.ready.summary.title', 'Your Personalized Goals')}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-black">{t('welcome.ready.summary.targetWeight', 'Target Weight')}</p>
                  <p className="text-sm text-black/60">{formData.targetWeight} {useMetric ? t('welcome.targetWeight.unitKg', 'kg') : t('welcome.targetWeight.unitLbs', 'lbs')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-black">{t('welcome.ready.summary.weeklyGoal', 'Weekly Goal')}</p>
                  <p className="text-sm text-black/60">{formData.weeklyGoal} {useMetric ? t('welcome.targetWeight.unitKg', 'kg') : t('welcome.targetWeight.unitLbs', 'lbs')} {t('welcome.ready.summary.perWeek', 'per week')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-black">{t('welcome.ready.summary.estimatedTimeline', 'Estimated Timeline')}</p>
                  <div className="text-sm text-black/60">
                    <p>{t('welcome.ready.summary.basedOnWeekly', 'Based on weekly goal: {{weeks}} weeks', { weeks: Math.abs(Math.ceil((formData.targetWeight - formData.weight) / formData.weeklyGoal)) })}</p>
                    {aiResult?.estimatedWeeks && (
                      <p className="mt-1">{t('welcome.ready.summary.aiRecommendation', 'AI recommendation: {{weeks}} weeks', { weeks: aiResult.estimatedWeeks })}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Get Started Button */}
          <button
            onClick={handleGetStarted}
            disabled={isLoading}
            className="w-full bg-black text-white px-6 py-4 rounded-2xl font-['SF Pro Display'] hover:bg-black/90 transition-colors relative overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>{t('welcome.ready.loading', 'Setting up your profile...')}</span>
              </div>
            ) : (
              t('welcome.ready.cta', "Let's get started!")
            )}
          </button>
        </div>
      )
    },
  ];

  useEffect(() => {
    if (aiStepReady && step === steps.length - 2) {
      const showNextText = () => {
        setIsVisible(false);

        setTimeout(() => {
          setCurrentAiText(prev => {
            const nextText = prev + 1;
            if (nextText <= 3) {
              setIsVisible(true);
            }
            if (nextText === 3) {
              setTimeout(() => {
                handleNext();
              }, 3000);
            }
            return nextText;
          });
        }, 2000);
      };

      const textTimeout = setTimeout(showNextText, 2750);
      return () => clearTimeout(textTimeout);
    }
  }, [aiStepReady, step, currentAiText]);

  if (step === 0) {
    return (
      <IntroStep
        onComplete={() => {
          setStep(1);
        }}
      />
    );
  }

  const activityLevels: ActivityLevel[] = ['LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE'];
  const experienceLevels: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const workoutDays: WorkoutDays[] = [2, 3, 4, 5, 6] as const;
  const genders: Gender[] = ['MALE', 'FEMALE'];
  const budgetOptions: Budget[] = ['BASIC', 'STANDARD', 'PREMIUM'];

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;
  const isRTL = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('ar');

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-b from-[#FAFAFA] from-0% via-[#F8F8F8] via-30% via-[#F5F5F5] via-60% to-[#F0F0F0] to-100% text-black px-5 py-8 font-['SF Pro Display'] overflow-y-auto overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Language Switcher - opposite corner from Back, Y-aligned to avoid overlap */}
      <div
        className={cn(
          'fixed z-50 top-8',
          isRTL ? 'left-5' : 'right-5'
        )}
      >
        <LanguageSwitcher />
      </div>
      {/* Top Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-black/5">
        <div
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Back Button */}
      {step > 0 && (
        <button
          onClick={prevStep}
          className={cn(
            'absolute top-8 p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors',
            isRTL ? 'right-5' : 'left-5'
          )}
        >
          {isRTL ? (
            <ChevronRight className="w-6 h-6 text-black" />
          ) : (
            <ChevronLeft className="w-6 h-6 text-black" />
          )}
        </button>
      )}

      {/* Main Content */}
      <div className="mt-16 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Title */}
            {steps[step]?.title && (
              <h1 className="text-4xl font-bold mb-2 font-['SF Pro Display'] text-black">
                {steps[step]?.title}
              </h1>
            )}
            {/* Description */}
            {steps[step]?.description && (
              <p className="text-black/60 text-lg mb-8">
                {steps[step]?.description}
              </p>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {steps[step]?.fields}
            </div>

            {/* Next Button */}
            {step !== steps.length - 1 && step !== steps.length - 2 && (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={cn(
                  "w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300",
                  isStepValid()
                    ? "bg-black text-white hover:bg-black/90"
                    : "bg-black/10 text-black/30 cursor-not-allowed"
                )}
              >
                {isStepValid() ? t('welcome.cta.continue', 'Continue') : t('welcome.cta.completeStep', 'Please complete this step')}
              </button>
            )}

            {/* Sign out button only on first step after intro */}
            {step === 1 && (
              <button
                onClick={() => {
                  if (window.confirm(t('welcome.confirmSignOut', 'Are you sure you want to sign out?'))) {
                    handleSignOut();
                  }
                }}
                className="w-full px-6 py-4 rounded-2xl font-medium transition-all duration-300 bg-white text-black hover:bg-black/5 border border-black/10"
              >
                {t('common.logout', 'Sign out')}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ProSubscriptionPanel
        isOpen={isProPanelOpen}
        onClose={() => setIsProPanelOpen(false)}
      />
    </motion.div>
  );
}


