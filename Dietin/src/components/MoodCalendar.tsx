import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, subDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Mood } from './MoodTracker';
import { useUserStore } from '@/stores/userStore';
import { useTranslation } from 'react-i18next';

interface MoodData {
  mood: Mood;
  date: string;
  timestamp: number;
}

interface MoodCalendarProps {
  moodHistory: MoodData[];
}

const getMoodColor = (mood: Mood): string => {
  switch (mood) {
    case 'very-happy':
      return 'bg-green-500';
    case 'happy':
      return 'bg-green-300';
    case 'neutral':
      return 'bg-yellow-300';
    case 'sad':
      return 'bg-red-300';
    case 'very-sad':
      return 'bg-red-500';
    default:
      return 'bg-gray-200';
  }
};

const getMoodEmoji = (mood: Mood): string => {
  switch (mood) {
    case 'very-happy':
      return '😄';
    case 'happy':
      return '🙂';
    case 'neutral':
      return '😐';
    case 'sad':
      return '😔';
    case 'very-sad':
      return '😢';
    default:
      return '';
  }
};

export const MoodCalendar = () => {
  const { user } = useUserStore();
  const { t } = useTranslation();

  // Only render if user is logged in and has completed onboarding
  if (!user || !user.onboardingCompleted || !user.isPro) {
    return null;
  }

  const moodHistory = user.moodHistory || [];

  // Generate last 30 days
  const last30Days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), i);
      const moodEntry = moodHistory.find(entry => 
        isSameDay(new Date(entry.timestamp), date)
      );
      return {
        date,
        mood: moodEntry?.mood || null,
      };
    }).reverse();
  }, [moodHistory]);

  // Calculate mood statistics
  const moodStats = useMemo(() => {
    const stats = {
      'very-happy': 0,
      'happy': 0,
      'neutral': 0,
      'sad': 0,
      'very-sad': 0,
    };
    
    moodHistory.forEach(entry => {
      stats[entry.mood]++;
    });

    return stats;
  }, [moodHistory]);

  return (
    <div className="bg-white backdrop-blur-sm rounded-xl border border-gray-200 shadow-xl overflow-hidden">
      <div className={cn("p-6")}>
        <div className="flex items-center justify-between h-[60px] mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 truncate">{t('profile.moodCalendar.title')}</h3>
            <p className="text-sm text-gray-600 mt-1 truncate">{t('profile.moodCalendar.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2" />
        </div>

        <div className="flex items-center justify-between mb-6">
          {Object.entries(moodStats).map(([mood, count]) => (
            <div key={mood} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{getMoodEmoji(mood as Mood)}</span>
              <span className="text-sm font-medium text-gray-600">{count}</span>
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="mt-6"
        >
          <div className="grid grid-cols-7 gap-2">
            {/* Day labels */}
            {['sun','mon','tue','wed','thu','fri','sat'].map(key => (
              <div key={key} className="text-center text-sm text-gray-500 font-medium">
                {t(`profile.moodCalendar.days.${key}`)}
              </div>
            ))}
            
            {/* Calendar days */}
            {last30Days.map((day, index) => (
              <motion.div
                key={day.date.toISOString()}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  "aspect-square rounded-lg flex items-center justify-center flex-col relative overflow-hidden",
                  day.mood ? getMoodColor(day.mood) : 'bg-gray-100'
                )}
              >
                <span className="text-xs font-medium text-gray-700/90">
                  {format(day.date, 'd')}
                </span>
                {day.mood && (
                  <span className="text-lg absolute inset-0 flex items-center justify-center bg-black/5">
                    {getMoodEmoji(day.mood)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MoodCalendar; 