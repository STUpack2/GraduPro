import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Analytics are now local-only; no Firestore syncing
import { useUserStore } from "@/stores/userStore";

interface DailyCaloriesData {
  entries: Array<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    healthScore?: number;
  }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

interface WeeklyStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealsAnalyzed: number;
  bestDay: {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    healthScore: number;
    differenceFromGoal: string;
  } | null;
  startDate: string;
  endDate: string;
  daysAnalyzed: number;
}

interface YearlyStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealsAnalyzed: number;
  averageMealsPerDay: number;
  bestWeek: {
    startDate: string;
    endDate: string;
    totalCalories: number;
    healthScore: number;
  } | null;
  year: number;
}

interface AnalyticsState {
  currentStreak: number;
  longestStreak: number;
  lastVisit: string | null;
  weeklyStats: WeeklyStats | null;
  yearlyStats: YearlyStats | null;
  updateStreak: () => void;
  updateWeeklyStats: (dailyCalories: Record<string, DailyCaloriesData>) => void;
  updateYearlyStats: (weeklyStats: WeeklyStats) => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastVisit: null,
      weeklyStats: null,
      yearlyStats: null,

      updateStreak: () => {
        const today = new Date().toISOString().split('T')[0];
        const state = get();
        const lastVisit = state.lastVisit;
        
        let newStreak = state.currentStreak;
        
        if (!lastVisit) {
          newStreak = 1;
        } else {
          const lastVisitDate = new Date(lastVisit);
          const todayDate = new Date(today);
          const diffDays = Math.floor((todayDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            // Consecutive day
            newStreak += 1;
          } else if (diffDays === 0) {
            // Same day, keep streak
            newStreak = state.currentStreak;
          } else {
            // Streak broken
            newStreak = 1;
          }
        }

        const newLongestStreak = Math.max(newStreak, state.longestStreak);

        set({
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastVisit: today
        });
      },

      updateWeeklyStats: (dailyCalories) => {
        if (!dailyCalories || typeof dailyCalories !== 'object') {
          return;
        }

        const state = get();
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let mealsAnalyzed = 0;
        let bestDay = null;
        let smallestDifference = Infinity;
        let daysAnalyzed = 0;

        // Get user goals from userStore
        const userStore = useUserStore.getState();
        const calorieGoal = userStore.user?.calorieGoal || 2000;

        // Calculate weekly totals and find best day based on calorie goal proximity
        Object.entries(dailyCalories).forEach(([date, data]) => {
          const dateObj = new Date(date);
          
          if (dateObj >= startOfWeek && dateObj <= endOfWeek) {
            if (data?.entries?.length > 0) {
              totalCalories += data.totalCalories || 0;
              totalProtein += data.totalProtein || 0;
              totalCarbs += data.totalCarbs || 0;
              totalFat += data.totalFat || 0;
              mealsAnalyzed += data.entries.length;
              daysAnalyzed++;

              // Calculate how close this day is to the calorie goal
              const calorieDiff = Math.abs(data.totalCalories - calorieGoal);
              const percentDiff = (calorieDiff / calorieGoal) * 100;

              const dayHealthScore = data.entries.reduce((acc, entry) => 
                acc + (entry.healthScore || 0), 0) / data.entries.length;

              if (percentDiff < smallestDifference && data.totalCalories > 0) {
                smallestDifference = percentDiff;
                bestDay = {
                  date,
                  calories: data.totalCalories,
                  protein: data.totalProtein,
                  carbs: data.totalCarbs,
                  fat: data.totalFat,
                  healthScore: dayHealthScore,
                  differenceFromGoal: percentDiff.toFixed(1)
                };
              }
            }
          }
        });

        // Always set today as the best day if no data is available
        if (!bestDay) {
          bestDay = {
            date: today.toISOString().split('T')[0],
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            healthScore: 0,
            differenceFromGoal: '100'
          };
        }

        const weeklyStats: WeeklyStats = {
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          mealsAnalyzed,
          bestDay,
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: endOfWeek.toISOString().split('T')[0],
          daysAnalyzed
        };

        set({ weeklyStats });
        get().updateYearlyStats(weeklyStats);
      },

      updateYearlyStats: (weeklyStats) => {
        if (!weeklyStats) {
          console.log('No weekly stats available');
          return;
        }

        const state = get();
        const currentYear = new Date().getFullYear();
        
        let yearlyStats = state.yearlyStats;
        if (!yearlyStats || yearlyStats.year !== currentYear) {
          yearlyStats = {
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            mealsAnalyzed: 0,
            averageMealsPerDay: 0,
            bestWeek: null,
            year: currentYear
          };
        }

        // Update yearly totals
        yearlyStats.totalCalories += weeklyStats.totalCalories;
        yearlyStats.totalProtein += weeklyStats.totalProtein;
        yearlyStats.totalCarbs += weeklyStats.totalCarbs;
        yearlyStats.totalFat += weeklyStats.totalFat;
        yearlyStats.mealsAnalyzed += weeklyStats.mealsAnalyzed;
        
        // Calculate average meals per day
        const daysSoFar = Math.floor((new Date().getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
        yearlyStats.averageMealsPerDay = yearlyStats.mealsAnalyzed / Math.max(daysSoFar, 1);

        // Update best week if current week is better
        const weekHealthScore = weeklyStats.bestDay?.healthScore || 0;
        if (!yearlyStats.bestWeek || weekHealthScore > (yearlyStats.bestWeek.healthScore || 0)) {
          yearlyStats.bestWeek = {
            startDate: weeklyStats.startDate,
            endDate: weeklyStats.endDate,
            totalCalories: weeklyStats.totalCalories,
            healthScore: weekHealthScore
          };
        }

        set({ yearlyStats });
      }
    }),
    {
      name: 'analytics-storage',
      partialize: (state) => ({
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastVisit: state.lastVisit,
        weeklyStats: state.weeklyStats,
        yearlyStats: state.yearlyStats
      })
    }
  )
); 