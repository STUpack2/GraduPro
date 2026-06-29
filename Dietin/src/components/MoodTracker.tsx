import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isAfter, set } from 'date-fns';
import { useUserStore } from '@/stores/userStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NavHide from '@/components/NavHide';
import { useTranslation } from 'react-i18next';

export type Mood = 'very-happy' | 'happy' | 'neutral' | 'sad' | 'very-sad';

interface MoodData {
  mood: Mood;
  date: string;
  timestamp: number;
}

const MOODS: { type: Mood; emoji: string }[] = [
  { type: 'very-happy', emoji: '😄' },
  { type: 'happy', emoji: '🙂' },
  { type: 'neutral', emoji: '😐' },
  { type: 'sad', emoji: '😔' },
  { type: 'very-sad', emoji: '😢' },
];

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

export const MoodTracker = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, updateUser } = useUserStore();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(() => {
    const saved = localStorage.getItem('moodTrackerLastCheck');
    return saved ? parseInt(saved, 10) : 0; // Initialize to 0 to ensure first check
  });
  const { t } = useTranslation();

  const checkMoodTracking = () => {
    const now = new Date();
    const today4am = set(now, { hours: 4, minutes: 0, seconds: 0, milliseconds: 0 });
    
    // Don't check if before 4am today
    if (!isAfter(now, today4am)) {
      return;
    }

    // Don't check if we've already checked after 4am today
    if (lastCheckTime > today4am.getTime()) {
      return;
    }

    // Update last check time
    const newCheckTime = now.getTime();
    setLastCheckTime(newCheckTime);
    localStorage.setItem('moodTrackerLastCheck', newCheckTime.toString());

    // Don't show if disabled in settings or not logged in
    if (!user || user.isMoodTrackerEnabled === false || !user.onboardingCompleted) {
      setIsOpen(false);
      setShowHint(false);
      return;
    }

    const today = format(now, 'yyyy-MM-dd');
    const lastMoodEntry = user.moodHistory?.[0];
    
    // Only show if no mood entry for today
    const shouldShow = !lastMoodEntry || format(new Date(lastMoodEntry.timestamp), 'yyyy-MM-dd') !== today;

    if (shouldShow) {
      setIsOpen(true);
      // Show hint after 3 seconds
      setTimeout(() => {
        setShowHint(true);
      }, 3000);
    }
  };

  // Check when component mounts and when user changes
  useEffect(() => {
    if (user && user.onboardingCompleted) {
      const timer = setTimeout(() => {
        checkMoodTracking();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Check at 4am
  useEffect(() => {
    if (user && user.onboardingCompleted) {
      const now = new Date();
      const next4am = set(now, { hours: 4, minutes: 0, seconds: 0, milliseconds: 0 });
      if (isAfter(now, next4am)) {
        next4am.setDate(next4am.getDate() + 1);
      }
      
      const timeUntil4am = next4am.getTime() - now.getTime();
      
      const timer = setTimeout(() => {
        checkMoodTracking();
      }, timeUntil4am);

      return () => clearTimeout(timer);
    }
  }, [user, lastCheckTime]);

  // Handle mood tracker toggle
  useEffect(() => {
    if (!user || user.isMoodTrackerEnabled === false) {
      setIsOpen(false);
      setShowHint(false);
    } else if (user.onboardingCompleted) {
      checkMoodTracking();
    }
  }, [user?.isMoodTrackerEnabled]);

  const handleMoodSelect = async (mood: Mood) => {
    const newMoodEntry: MoodData = {
      mood,
      date: format(new Date(), 'yyyy-MM-dd'),
      timestamp: Date.now(),
    };

    // Update user's mood history locally only
    const updatedMoodHistory = user?.moodHistory ? [newMoodEntry, ...user.moodHistory] : [newMoodEntry];

    // Persist to local store (zustand persists to localStorage)
    updateUser({ moodHistory: updatedMoodHistory });

    setSelectedMood(mood);
    setTimeout(() => {
      setIsOpen(false);
      setSelectedMood(null);
      setShowHint(false);
    }, 1000);
  };

  // If mood tracker is disabled or user not ready or not Pro, don't render anything
  if (!user || user.isMoodTrackerEnabled === false || !user.onboardingCompleted || !user.isPro) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <NavHide isAIOpen={isOpen} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              duration: 0.5,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm touch-none"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              transition={{ 
                duration: 0.5,
                ease: [0.4, 0, 0.2, 1],
                delay: 0.1
              }}
              className="bg-white rounded-3xl p-8 mx-4 max-w-md text-center shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {t(`profile.mood.greeting.${getGreetingKey()}`)}
                </h2>
                <p className="text-gray-600">{t('profile.mood.question')}</p>
              </motion.div>

              <div className="grid grid-cols-5 gap-2">
                {MOODS.map((mood) => (
                  <motion.button
                    key={mood.type}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleMoodSelect(mood.type)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200",
                      selectedMood === mood.type
                        ? "bg-primary text-white shadow-lg"
                        : "hover:bg-gray-100 text-gray-900"
                    )}
                  >
                    <span className="text-2xl mb-1">{mood.emoji}</span>
                    <span className="text-[11px] font-bold leading-none">{t(`profile.mood.moods.${mood.type}`)}</span>
                  </motion.button>
                ))}
              </div>

              <AnimatePresence>
                {showHint && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute bottom-3 left-0 right-0 text-[10px] text-gray-400 text-center"
                  >
                    {t('profile.mood.hint')}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoodTracker; 