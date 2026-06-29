import { useEffect } from 'react';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useUserStore } from '@/stores/userStore';
import { motion } from 'framer-motion';
import { Trophy, LineChart, Target, Flame, Lock } from 'lucide-react';
import ProFeatures from './ProFeatures';
import { useTranslation } from 'react-i18next';

interface AnalyticsDisplayProps {
  setIsProPanelOpen: (isOpen: boolean) => void;
}

export default function AnalyticsDisplay({ setIsProPanelOpen }: AnalyticsDisplayProps) {
  const { weeklyStats, updateStreak, updateWeeklyStats } = useAnalyticsStore();
  const { dailyCalories } = useUserStore();
  const { t } = useTranslation();

  useEffect(() => {
    // Only update if there are changes to dailyCalories
    const handleUpdate = () => {
      updateStreak();
      updateWeeklyStats(dailyCalories);
    };

    // Initial update
    handleUpdate();
    
    // Update every 5 minutes instead of 30 seconds
    const interval = setInterval(handleUpdate, 300000);

    return () => clearInterval(interval);
  }, [updateStreak, updateWeeklyStats, dailyCalories]);

  const cardContent = (
    <div className="space-y-4">
        {/* Weekly Stats */}
        <div className="space-y-4">
          {/* Top row: Total Calories + Meals Analyzed side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white shadow-lg border border-black/5 rounded-3xl px-4 py-5 hover:bg-white/95 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-black whitespace-nowrap">{t('analytics.total_weekly_calories')}</p>
                </div>
                <p className="text-2xl font-semibold text-black">{weeklyStats?.totalCalories?.toLocaleString() || '0'}</p>
                {weeklyStats?.daysAnalyzed > 0 && (
                  <p className="text-sm text-black/60">
                    {Math.round((weeklyStats?.totalCalories || 0) / weeklyStats.daysAnalyzed).toLocaleString()} {t('analytics.avg_per_day')}
                    <span className="text-xs text-black/40 ml-1">({weeklyStats.daysAnalyzed} {t('analytics.days')})</span>
                  </p>
                )}
              </div>
            </div>
            <div className="bg-white shadow-lg border border-black/5 rounded-3xl px-4 py-5 hover:bg-white/95 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-black whitespace-nowrap">{t('analytics.meals_analyzed')}</p>
                </div>
                <p className="text-2xl font-semibold text-black">{weeklyStats?.mealsAnalyzed || 0}</p>
                {weeklyStats?.daysAnalyzed > 0 && (
                  <p className="text-sm text-black/60">
                    {((weeklyStats?.mealsAnalyzed || 0) / weeklyStats.daysAnalyzed).toFixed(1)} {t('analytics.avg_per_day')}
                    <span className="text-xs text-black/40 ml-1">({weeklyStats.daysAnalyzed} {t('analytics.days')})</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Best Day */}
          <div className="bg-white shadow-lg border border-black/5 rounded-3xl p-4 hover:bg-white/95 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-black">{t('analytics.best_day')}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-black">
                    {weeklyStats?.bestDay ? new Date(weeklyStats.bestDay.date).toLocaleDateString(document.dir === 'rtl' ? 'ar-SA' : 'en-US', { weekday: 'long' }) : t('analytics.no_data_yet')}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 rounded-full bg-primary/20">
                      <p className="text-xs font-medium text-primary">
                        {weeklyStats?.bestDay?.calories > 0 ? `${(100 - parseFloat(weeklyStats.bestDay.differenceFromGoal)).toFixed(0)}% ${t('analytics.match')}` : t('analytics.no_meals_logged')}
                      </p>
                    </div>
                    <p className="text-xs text-black/60">
                      {weeklyStats?.bestDay?.calories?.toLocaleString() || 0} cal
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-sm text-black">{weeklyStats?.bestDay?.protein || 0}g</p>
                    <p className="text-xs text-black/40">{t('analytics.protein')}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-sm text-black">{weeklyStats?.bestDay?.carbs || 0}g</p>
                    <p className="text-xs text-black/40">{t('analytics.carbs')}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-sm text-black">{weeklyStats?.bestDay?.fat || 0}g</p>
                    <p className="text-xs text-black/40">{t('analytics.fat')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );

  return (
    <div className="relative">
      {cardContent}
    </div>
  );
} 