import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/userStore';
import { useNutritionStore } from '@/stores/nutritionStore';
import { useProgressStore } from '@/stores/progressStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface HydrationTrackerProps {
  className?: string;
  setIsPopupOpen: (isOpen: boolean) => void;
}

const ML_PER_CUP = 250; // Standard cup size in ml
const REMINDER_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

const HydrationTracker = ({ className, setIsPopupOpen }: HydrationTrackerProps) => {
  const { user, getDailyCalories } = useUserStore();
  const { burnedCalories } = useNutritionStore();
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const dailyData = getDailyCalories(today);
  
  const [waterIntake, setWaterIntake] = useState(0);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [lastReminderTime, setLastReminderTime] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Calculate required water intake based on metabolism and activity
  const baseMetabolism = user?.metabolism || 2000;
  const caloriesBurned = burnedCalories || 0;
  const caloriesConsumed = dailyData?.totalCalories || 0;
  const totalCaloriesMetabolized = baseMetabolism + caloriesBurned + caloriesConsumed;
  
  // 1ml of water per calorie metabolized, rounded to nearest 100ml
  const requiredWater = Math.round(totalCaloriesMetabolized / 100) * 100;
  const progress = (waterIntake / requiredWater) * 100;

  // Calculate cups
  const cupsConsumed = Math.round((waterIntake / ML_PER_CUP) * 10) / 10;
  const cupsRequired = Math.ceil(requiredWater / ML_PER_CUP);
  const cupsRemaining = Math.max(0, Math.ceil((requiredWater - waterIntake) / ML_PER_CUP));

  // Handle notifications
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkAndNotify = () => {
      if (!remindersEnabled) return;
      
      const now = new Date();
      const hoursSinceLastReminder = lastReminderTime 
        ? (now.getTime() - lastReminderTime.getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (hoursSinceLastReminder >= 1 && waterIntake < requiredWater) {
        const nextCup = Math.ceil(waterIntake / ML_PER_CUP) + 1;
        toast(t('hydration.tracker.toast.timeToHydrate'), {
          description: t('hydration.tracker.toast.tryCup', { number: nextCup, ml: ML_PER_CUP }),
          action: {
            label: t('hydration.tracker.toast.done'),
            onClick: () => addWater()
          }
        });
        setLastReminderTime(now);
      }
    };

    if (remindersEnabled) {
      interval = setInterval(checkAndNotify, REMINDER_INTERVAL);
      // Initial check
      checkAndNotify();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [remindersEnabled, lastReminderTime, waterIntake, requiredWater]);

  // Mirror today's hydration into progressStore so the Progress dashboard,
  // streaks, and fitness-score calculation can see it. Skip the very first
  // render — it's just initial state, no user action yet.
  useEffect(() => {
    if (waterIntake <= 0) return;
    const goal = requiredWater > 0 ? requiredWater : 2500;
    void useProgressStore.getState().recordHydration(waterIntake, { goalMl: goal });
  }, [waterIntake, requiredWater]);

  const addWater = () => {
    setWaterIntake(prev => {
      const newValue = Math.min(prev + ML_PER_CUP, requiredWater);
      if (newValue === requiredWater) {
        toast.success(t('hydration.tracker.goalReached'));
      }
      return newValue;
    });
  };

  const removeWater = () => {
    setWaterIntake(prev => Math.max(prev - ML_PER_CUP, 0));
  };

  const toggleReminders = () => {
    setRemindersEnabled(prev => !prev);
    if (!remindersEnabled) {
      toast.success(t('hydration.tracker.reminders.enabledTitle'), {
        description: t('hydration.tracker.reminders.enabledDesc')
      });
    }
  };

  // Calculate remaining water needed
  const remainingWater = requiredWater - waterIntake;

  return (
    <Card className={cn(
      "relative overflow-hidden border-gray-200 rounded-3xl min-h-[400px]",
      "bg-white shadow-sm",
      className
    )}>
      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="text-[17px] font-semibold text-gray-800 tracking-tight">
          {t('hydration.tracker.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl font-semibold text-gray-800 flex items-baseline gap-1">
                {waterIntake.toLocaleString()}
                <span className="text-sm text-gray-600">{t('hydration.units.ml')}</span>
              </div>
              <div className="text-sm text-gray-600 flex items-baseline gap-1">
                <span>{cupsConsumed}</span>
                <span className="text-xs">{t('hydration.tracker.cups')}</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 uppercase tracking-wider flex items-center gap-1 mt-1">
              <span className="text-blue-600">{Math.round(progress)}%</span> 
              <span>{t('hydration.tracker.ofAmount', { amount: requiredWater.toLocaleString() })}</span>
              <span className="text-gray-500">{t('hydration.tracker.cupsCount', { count: cupsRequired })}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={removeWater}
              className="p-2.5 rounded-3xl bg-gray-100 border border-gray-200 active:bg-gray-200 transition-colors"
              aria-label={t('hydration.tracker.aria.removeCup', { ml: ML_PER_CUP })}
            >
              <Minus className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={addWater}
              className="p-2.5 rounded-3xl bg-blue-500/10 border border-blue-500/20 active:bg-blue-500/20 transition-colors"
              aria-label={t('hydration.tracker.aria.addCup', { ml: ML_PER_CUP })}
            >
              <Plus className="h-4 w-4 text-blue-600" />
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
              <div className="relative h-36 w-28 mx-auto">
                {/* Glass Container */}
                <div className="absolute inset-0 rounded-3xl border-2 border-gray-200 overflow-hidden backdrop-blur-sm bg-gray-50">
                  {/* Water Fill Animation */}
                  <motion.div
                    initial={{ height: "0%" }}
                    animate={{ height: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/80 to-blue-400/50 backdrop-blur-sm"
                    style={{
                      boxShadow: "0 0 30px rgba(59, 130, 246, 0.3)",
                    }}
                  />
                  
                  {/* Wave Effect */}
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: `${progress}%` }}>
                    <div className="absolute inset-0 opacity-50">
                      <div className="relative w-[200%] h-full">
                        <motion.div
                          className="absolute top-0 left-0 w-[50%] h-full bg-blue-400/30"
                          animate={{
                            x: ["-100%", "0%"]
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            ease: "linear"
                          }}
                          style={{
                            borderRadius: "50% 50% 0 0"
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Measurement Lines */}
                  <div className="absolute inset-x-0 inset-y-4 flex flex-col justify-between">
                    {[75, 50, 25].map((level) => (
                      <div key={level} className="w-full h-[1px] bg-gray-300 relative">
                        <span className="absolute -right-1 -translate-y-1/2 text-[8px] text-gray-500">
                          {level}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Cup Indicators */}
                  <div className="absolute -right-8 inset-y-4 flex flex-col justify-between">
                    {[4, 3, 2, 1].map((cups) => (
                      <div key={cups} className="flex items-center gap-1 text-[8px] text-gray-500">
                        <span>{cups}c</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Remaining Water Info */}
              <div className="mt-4 text-center">
                {remainingWater > 0 ? (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">
                      {t('hydration.tracker.moreNeeded', { amount: remainingWater.toLocaleString() })}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t('hydration.tracker.aboutMoreCups', { count: cupsRemaining })}
                    </div>
                    {remindersEnabled && lastReminderTime && (
                      <div className="text-[10px] text-blue-600/60">
                        {t('hydration.tracker.nextReminder', { minutes: Math.max(0, Math.ceil(60 - ((new Date().getTime() - lastReminderTime.getTime()) / (1000 * 60)))) })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-green-600">
                    {t('hydration.tracker.goalReached')}
                  </div>
                )}
              </div>
        </motion.div>
      </CardContent>
    </Card>
  );
};

export default HydrationTracker; 