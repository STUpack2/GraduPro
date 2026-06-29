import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CalorieEntry } from '@/types';
import { doc, updateDoc, getFirestore, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';
import i18n from '@/i18n/i18n';

// Helper to format local date as yyyy-MM-dd (avoids UTC shift issues)
const getLocalDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface DailyCalories {
  date: string;
  entries: CalorieEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

interface MoodData {
  mood: 'very-happy' | 'happy' | 'neutral' | 'sad' | 'very-sad';
  date: string;
  timestamp: number;
}

interface UserState {
  user: {
    name?: string;
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    bmi?: number;
    bmiCategory?: string;
    calorieGoal: number;
    proteinGoal: number;
    carbsGoal: number;
    fatGoal: number;
    metabolism: number;
    profilePicture?: string;  // Base64 encoded image
    experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    isPro?: boolean; // New field for premium status
    isMoodTrackerEnabled?: boolean;
    onboardingCompleted?: boolean;
    moodHistory?: MoodData[];
    dietaryPreferences?: string[];
    allergies?: string[];
    cuisinePreferences?: string[];
    aiPersonalization?: string;
  } | null;
  dailyCalories: { [date: string]: DailyCalories };
  lastResetDate?: string;
  customTags: string[];
  dailyImageAnalysis: number;
  dailyMealAnalysis: number;
  lastQuotaReset: string;
  yearlyMeals: { [year: number]: CalorieEntry[] };
  addCalorieEntry: (entry: Omit<CalorieEntry, "id">) => void;
  editCalorieEntry: (date: string, id: string, updates: Partial<CalorieEntry>) => void;
  removeCalorieEntry: (date: string, id: string) => void;
  getDailyCalories: (date: string) => DailyCalories | undefined;
  getYearlyMeals: (year: number) => CalorieEntry[];
  updateUser: (data: Partial<UserState["user"]>) => void;
  addCustomTag: (tag: string) => void;
  removeCustomTag: (tag: string) => void;
  checkAndResetDaily: () => void;
  updateProfilePicture: (imageBase64: string) => void;
  resetUser: () => void;
  resetDailyQuotas: () => void;
  incrementImageAnalysis: () => void;
  incrementMealAnalysis: () => void;
  checkAndResetQuotas: () => void;
  loadMealDataFromFirestore: () => Promise<void>;
  checkAndResetYearlyMeals: () => void;
  setUser: (user: UserState["user"]) => void;
  updateAIPersonalization: (text: string) => void;
}

// Debounce + throttle + dedupe for Firestore writes
const updateTimeouts: { [key: string]: NodeJS.Timeout } = {};
const lastSyncedDoc: { [userId: string]: Record<string, any> } = {};
const lastWriteAt: { [userId: string]: number } = {};
const LAST_WRITE_MIN_MS = 30000; // minimum spacing between writes per user (30s)

const sanitizePartial = (obj: Record<string, any> | null | undefined) => {
  const out: Record<string, any> = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || typeof v === 'function') continue; // Firestore rejects undefined
    out[k] = v;
  }
  return out;
};

const diffProvidedKeys = (prev: Record<string, any>, nextPartial: Record<string, any>) => {
  const diff: Record<string, any> = {};
  for (const k of Object.keys(nextPartial)) {
    if (prev[k] !== nextPartial[k]) diff[k] = nextPartial[k];
  }
  return diff;
};

// Exported helper: seed baseline to prevent first redundant write after login
export const seedUserDocBaseline = (userId: string, data: Record<string, any> | null | undefined) => {
  lastSyncedDoc[userId] = { ...sanitizePartial(data) };
};

const debouncedFirestoreUpdate = (userId: string, data: any) => {
  const now = Date.now();
  const partial = sanitizePartial(data);
  if (Object.keys(partial).length === 0) return;

  // Dedupe only across provided keys
  const previous = lastSyncedDoc[userId] || {};
  const toWrite = diffProvidedKeys(previous, partial);
  if (Object.keys(toWrite).length === 0) return;

  const baseKey = `${userId}-user-sync`; // stable key per user
  if (updateTimeouts[baseKey]) {
    clearTimeout(updateTimeouts[baseKey]);
  }

  // Throttle: enforce minimum spacing between writes per user
  const sinceLast = now - (lastWriteAt[userId] || 0);
  const delay = Math.max(1000, LAST_WRITE_MIN_MS - sinceLast);

  updateTimeouts[baseKey] = setTimeout(async () => {
    const payload = { ...toWrite, updatedAt: new Date().toISOString() };
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let success = false;
    while (retryCount < MAX_RETRIES && !success) {
      try {
        await updateDoc(doc(db, 'users', userId), payload);
        lastSyncedDoc[userId] = { ...(lastSyncedDoc[userId] || {}), ...toWrite };
        lastWriteAt[userId] = Date.now();
        success = true;
      } catch (error: any) {
        retryCount++;
        if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
          await new Promise(r => setTimeout(r, retryCount * 1000));
        } else if (error?.code === 'resource-exhausted') {
          await new Promise(r => setTimeout(r, 5000));
        } else if (retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, retryCount * 1000));
        } else {
          // Give up; keep lastSynced as-is so we try again next change
          break;
        }
      }
    }
    delete updateTimeouts[baseKey];
  }, delay);
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      dailyCalories: {},
      lastResetDate: undefined,
      customTags: [],
      dailyImageAnalysis: 0,
      dailyMealAnalysis: 0,
      lastQuotaReset: getLocalDateKey(new Date()),
      yearlyMeals: {},

      setUser: (user) => {
        set({ user });
      },

      // Load meal data from Firestore
      loadMealDataFromFirestore: async () => {
        // Meals are now local-only. No-op to preserve API for callers.
        return;
      },

      checkAndResetDaily: () => {
        const state = get();
        const now = new Date();
        const today = getLocalDateKey(now);
        const resetTime = new Date(now);
        resetTime.setHours(4, 0, 0, 0);

        // If it's past 4am and we haven't reset today
        if (now > resetTime && state.lastResetDate !== today) {
          // Keep all historical data, just update today's entries
          const updatedLog = { ...state.dailyCalories };
          
          // Only filter today's entries if they exist
          if (updatedLog[today]) {
            updatedLog[today].entries = updatedLog[today].entries.filter(entry => {
              const entryTime = new Date(entry.timestamp);
              return entryTime > resetTime;
            });

            // Recalculate today's totals
            const totals = updatedLog[today].entries.reduce(
              (acc, curr) => ({
                totalCalories: acc.totalCalories + curr.calories,
                totalProtein: acc.totalProtein + curr.protein,
                totalCarbs: acc.totalCarbs + curr.carbs,
                totalFat: acc.totalFat + curr.fat,
              }),
              { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
            );

            updatedLog[today] = {
              ...updatedLog[today],
              ...totals
            };
          }

          set({
            dailyCalories: updatedLog,
            lastResetDate: today
          });
        }
      },

      addCalorieEntry: (entry) => {
        set((state) => {
          // First check if we need to reset
          get().checkAndResetDaily();
          
          // Check and reset yearly meals if needed
          get().checkAndResetYearlyMeals();

          const date = getLocalDateKey(new Date());
          const existingData = state.dailyCalories[date] || {
            date,
            entries: [],
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
          };

          const newEntry: CalorieEntry = {
            ...entry,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
          };

          const updatedEntries = [...existingData.entries, newEntry];
          
          const totals = updatedEntries.reduce(
            (acc, curr) => ({
              totalCalories: acc.totalCalories + curr.calories,
              totalProtein: acc.totalProtein + curr.protein,
              totalCarbs: acc.totalCarbs + curr.carbs,
              totalFat: acc.totalFat + curr.fat,
            }),
            { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
          );

          // Maintain yearlyMeals locally
          const year = new Date(newEntry.timestamp).getFullYear();
          const prevYearEntries = (state.yearlyMeals?.[year] || []);
          const updatedYearlyMeals = {
            ...(state.yearlyMeals || {}),
            [year]: [...prevYearEntries, newEntry]
          };

          const updatedDailyCalories = {
            ...state.dailyCalories,
            [date]: {
              ...existingData,
              entries: updatedEntries,
              ...totals,
            },
          };
          
          return {
            ...state,
            dailyCalories: updatedDailyCalories,
            yearlyMeals: updatedYearlyMeals,
          };
        });
      },

      editCalorieEntry: (date, id, updates) => {
        set((state) => {
          // First check if we need to reset
          get().checkAndResetDaily();

          const dailyData = state.dailyCalories[date];
          if (!dailyData) return state;

          const updatedEntries = dailyData.entries.map(entry => 
            entry.id === id ? { ...entry, ...updates } : entry
          );
          
          const totals = updatedEntries.reduce(
            (acc, curr) => ({
              totalCalories: acc.totalCalories + curr.calories,
              totalProtein: acc.totalProtein + curr.protein,
              totalCarbs: acc.totalCarbs + curr.carbs,
              totalFat: acc.totalFat + curr.fat,
            }),
            { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
          );

          const yearlyMeals = { ...state.yearlyMeals };
          const entryToUpdate = dailyData.entries.find(entry => entry.id === id);
          
          if (entryToUpdate) {
            const year = new Date(entryToUpdate.timestamp).getFullYear();
            const yearEntries = yearlyMeals[year] || [];
            
            const updatedYearEntries = yearEntries.map(entry => 
              entry.id === id ? { ...entry, ...updates } : entry
            );
            
            yearlyMeals[year] = updatedYearEntries;
          }
          
          const updatedDailyCalories = {
            ...state.dailyCalories,
            [date]: {
              ...dailyData,
              entries: updatedEntries,
              ...totals,
            },
          };
          
          return {
            ...state,
            dailyCalories: updatedDailyCalories,
            yearlyMeals
          };
        });
      },

      removeCalorieEntry: (date, id) => {
        set((state) => {
          // First check if we need to reset
          get().checkAndResetDaily();

          const dailyData = state.dailyCalories[date];
          if (!dailyData) return state;

          const entryToRemove = dailyData.entries.find(entry => entry.id === id);
          const updatedEntries = dailyData.entries.filter((entry) => entry.id !== id);
          
          const totals = updatedEntries.reduce(
            (acc, curr) => ({
              totalCalories: acc.totalCalories + curr.calories,
              totalProtein: acc.totalProtein + curr.protein,
              totalCarbs: acc.totalCarbs + curr.carbs,
              totalFat: acc.totalFat + curr.fat,
            }),
            { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
          );

          const yearlyMeals = { ...state.yearlyMeals };
          
          if (entryToRemove) {
            const year = new Date(entryToRemove.timestamp).getFullYear();
            const yearEntries = yearlyMeals[year] || [];
            
            yearlyMeals[year] = yearEntries.filter(entry => entry.id !== id);
          }
          
          const updatedDailyCalories = {
            ...state.dailyCalories,
            [date]: {
              ...dailyData,
              entries: updatedEntries,
              ...totals,
            },
          };
          
          return {
            ...state,
            dailyCalories: updatedDailyCalories,
            yearlyMeals
          };
        });
      },

      getDailyCalories: (date) => {
        return get().dailyCalories[date];
      },

      getYearlyMeals: (year) => {
        return get().yearlyMeals[year] || [];
      },

      updateUser: (data) => {
        try {
          set((state) => {
            const newState = {
              ...state,
              user: state.user ? { ...state.user, ...data } : {
                calorieGoal: 2000,
                proteinGoal: 150,
                carbsGoal: 200,
                fatGoal: 67,
                metabolism: 2200,
                isMoodTrackerEnabled: true,
                onboardingCompleted: false,
                moodHistory: [],
                dietaryPreferences: [],
                allergies: [],
                cuisinePreferences: [],
                aiPersonalization: '',
                ...data
              }
            };

            // Calculate BMI if weight or height is updated
            if ((data.weight || data.height) && newState.user) {
              const weight = data.weight || newState.user.weight;
              const height = data.height || newState.user.height;

              if (weight && height) {
                const heightInMeters = height / 100;
                const bmi = Number((weight / (heightInMeters * heightInMeters)).toFixed(1));
                let bmiCategory = '';

                if (bmi < 18.5) bmiCategory = 'Underweight';
                else if (bmi < 25) bmiCategory = 'Healthy';
                else if (bmi < 30) bmiCategory = 'Overweight';
                else bmiCategory = 'Obese';

                newState.user = {
                  ...newState.user,
                  bmi,
                  bmiCategory
                };
              }
            }

            // Sync with Firestore (only when meaningful changes exist)
            const userId = auth.currentUser?.uid;
            if (userId) {
              // compute only changed keys to avoid writing undefined
              const prev = state.user || {};
              const next = newState.user || {};
              const partial: Record<string, any> = {};
              for (const k of Object.keys(next)) {
                // Do NOT sync moodHistory to Firestore; keep it local-only
                if (k === 'moodHistory') continue;
                if ((next as any)[k] !== (prev as any)[k] && (next as any)[k] !== undefined) {
                  partial[k] = (next as any)[k];
                }
              }
              if (Object.keys(partial).length > 0) debouncedFirestoreUpdate(userId, partial);
            }

            return newState;
          });
        } catch (error) {
          console.error('Error updating user state:', error);
          toast.error(i18n.t('user.updateFailed', { defaultValue: "We couldn't save your changes. Please try again." }));
        }
      },

      updateProfilePicture: (imageBase64: string) => {
        set((state) => {
          const newState = {
            ...state,
            user: state.user ? {
              ...state.user,
              profilePicture: imageBase64
            } : null
          };

          // Sync with Firestore
          const userId = auth.currentUser?.uid;
          if (userId) {
            console.log('Syncing profile picture with Firestore');
            debouncedFirestoreUpdate(userId, {
              profilePicture: imageBase64
            });
          }

          return newState;
        });
      },

      addCustomTag: (tag: string) => {
        set((state) => {
          const newTags = [...state.customTags, tag];
          return { ...state, customTags: newTags };
        });
      },

      removeCustomTag: (tag: string) => {
        set((state) => {
          const newTags = state.customTags.filter(t => t !== tag);
          return { ...state, customTags: newTags };
        });
      },

      resetUser: () => {
        // Keep the yearly meals when resetting the user
        const yearlyMeals = get().yearlyMeals;
        set({
          user: null,
          dailyCalories: {},
          lastResetDate: undefined,
          customTags: [],
          dailyImageAnalysis: 0,
          dailyMealAnalysis: 0,
          lastQuotaReset: getLocalDateKey(new Date()),
          yearlyMeals // Preserve yearly meals
        });
      },

      resetDailyQuotas: () => {
        const userId = auth.currentUser?.uid;
        const newState = {
          dailyImageAnalysis: 0,
          dailyMealAnalysis: 0,
          lastQuotaReset: getLocalDateKey(new Date())
        };

        if (userId) {
          // First update Firestore
          updateDoc(doc(db, "users", userId), newState)
            .then(() => {
              // Only update local state after successful Firestore update
              set(newState);
              console.log('Daily quotas reset successfully');
            })
            .catch((error) => {
              console.error('Failed to reset daily quotas in Firestore:', error);
            });
        } else {
          // If not logged in, just update local state
          set(newState);
        }
      },

      checkAndResetQuotas: () => {
        const state = get();
        const now = new Date();
        const lastReset = new Date(state.lastQuotaReset);
        const hoursSinceLastReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        
        // Reset if 6 hours have passed since last reset
        if (hoursSinceLastReset >= 6) {
          const userId = auth.currentUser?.uid;
          const newState = {
            dailyImageAnalysis: 0,
            dailyMealAnalysis: 0,
            lastQuotaReset: now.toISOString()
          };

          if (userId) {
            // First update Firestore
            updateDoc(doc(db, "users", userId), {
              ...newState,
              lastUpdated: now.toISOString()
            })
              .then(() => {
                // Only update local state after successful Firestore update
                set(newState);
                console.log('Quotas reset successfully');
              })
              .catch((error) => {
                console.error('Failed to reset quotas in Firestore:', error);
              });
          } else {
            // If not logged in, just update local state
            set(newState);
          }
        }
      },
      
      // Check and reset yearly meals when the year changes
      checkAndResetYearlyMeals: () => {
        const state = get();
        const currentYear = new Date().getFullYear();
        const yearlyMeals = state.yearlyMeals || {};
        
        // If we have data for the current year, no need to reset
        if (yearlyMeals[currentYear]) {
          return;
        }
        
        // Initialize the current year with an empty array
        const updatedYearlyMeals = {
          ...yearlyMeals,
          [currentYear]: []
        };
        set({ yearlyMeals: updatedYearlyMeals });
      },

      incrementImageAnalysis: () => {
        const userId = auth.currentUser?.uid;
        const currentState = get();
        
        // First check if we need to reset quotas
        get().checkAndResetQuotas();
        
        if (userId) {
          const newCount = currentState.dailyImageAnalysis + 1;
          // Debounced and throttled sync
          debouncedFirestoreUpdate(userId, { dailyImageAnalysis: newCount });
          // Update local state immediately for UI responsiveness
          set({ dailyImageAnalysis: newCount });
        }
      },

      incrementMealAnalysis: () => {
        const userId = auth.currentUser?.uid;
        const currentState = get();
        
        // First check if we need to reset quotas
        get().checkAndResetQuotas();
        
        if (userId) {
          const newCount = currentState.dailyMealAnalysis + 1;
          // Debounced and throttled sync
          debouncedFirestoreUpdate(userId, { dailyMealAnalysis: newCount });
          // Update local state immediately
          set({ dailyMealAnalysis: newCount });
        }
      },

      updateAIPersonalization: (text: string) => {
        const userId = auth.currentUser?.uid;
        
        set((state) => {
          const newState = {
            user: state.user ? { ...state.user, aiPersonalization: text } : null
          };
          
          // Sync with Firestore if user is authenticated
          if (userId) {
            debouncedFirestoreUpdate(userId, {
              aiPersonalization: text
            });
          }
          
          return newState;
        });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        dailyCalories: state.dailyCalories,
        customTags: state.customTags,
        dailyImageAnalysis: state.dailyImageAnalysis,
        dailyMealAnalysis: state.dailyMealAnalysis,
        lastQuotaReset: state.lastQuotaReset,
        yearlyMeals: state.yearlyMeals
      })
    }
  )
);
