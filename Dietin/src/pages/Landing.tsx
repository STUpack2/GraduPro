import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import TopStatusBackground from '@/components/TopStatusBackground';
import MealPlanningVector from '@/assets/Vectors/20250811_2231_Healthy Eating Scene_remix_01k2d9rky1ffk88pv408hsdmap.png';
import WorkoutTrackingVector from '@/assets/Vectors/20250811_2235_Man Exercising Cartoon_remix_01k2d9yqnpesnvbdm0166qgm9j.png';
import AIAnalysisVector from '@/assets/Vectors/20250811_2238_Man With Checklist_remix_01k2da4t19f4pt57p5911pfnba.png';
import WelcomeVector from '@/assets/Vectors/20250811_2245_Friendly Wave_remix_01k2dajvsjexmae286va9hkqqr.png';
// Preload Auth page decorative image too so it doesn't pop-in on first open
import ShapesTrio from '@/assets/Vectors/20250831_0538_Cheerful Shapes Trio_remix_01k3yzrkpee20vrmzy5m9xxnmv.png';

// Landing page: simplified (no background videos or screenshots)

const slides = [
  {
    titleKey: 'landing.slides.welcome_title',
    descriptionKey: 'landing.slides.welcome_desc',
    altKey: 'landing.alts.welcome',
  },
  {
    titleKey: 'landing.slides.meal_title',
    descriptionKey: 'landing.slides.meal_desc',
    altKey: 'landing.alts.meal_planning',
  },
  {
    titleKey: 'landing.slides.workout_title',
    descriptionKey: 'landing.slides.workout_desc',
    altKey: 'landing.alts.workout_tracking',
  },
  {
    titleKey: 'landing.slides.ai_title',
    descriptionKey: 'landing.slides.ai_desc',
    altKey: 'landing.alts.ai_analysis',
  }
];

const transition = {
  type: "tween",
  duration: 0.25,
  ease: "easeOut"
};

// No video transitions needed

const fadeInUp = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: {
    ...transition,
    duration: 0.4
  }
};

const fadeScale = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: {
    ...transition,
    duration: 0.4
  }
};

export const Landing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [seenLanding, setSeenLanding] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if this is the first time viewing the landing page
    const hasSeenLanding = localStorage.getItem('hasSeenLanding');
    if (hasSeenLanding) {
      setSeenLanding(true);
      // If user has seen landing, go to auth; App will route verified users onward
      navigate('/home', { replace: true });
    } else {
      setSeenLanding(false);
    }
  }, []);

  // Preload landing images (and Auth decorative) before showing the content for first-time visitors
  useEffect(() => {
    if (seenLanding !== false) return; // only for first-time visitors

    const sources = [WelcomeVector, MealPlanningVector, WorkoutTrackingVector, AIAnalysisVector, ShapesTrio];
    let cancelled = false;

    Promise.all(
      sources.map((src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // consider errored as done to avoid blocking
          img.src = src as unknown as string;
        })
      )
    ).then(() => {
      if (!cancelled) setAssetsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [seenLanding]);

  // Lock scroll and disable overscroll while on the landing page
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  // No media preloading required

  const handleNext = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    if (currentSlide === slides.length - 1) {
      localStorage.setItem('hasSeenLanding', 'true');
      navigate('/home', { replace: true });
    } else {
      setCurrentSlide(prev => prev + 1);
      setIsTransitioning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 text-black flex flex-col overflow-hidden"
      style={{
        // Prevent any bounce/overscroll revealing outer app background
        backgroundColor: '#ffffff',
        overscrollBehavior: 'none',
        height: '100dvh',
        width: '100vw',
      }}
    >
      {/* Background gradient to ensure pure white at bottom without showing App background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(to bottom, #fcfcfc 0%, #ffffff 40%, #ffffff 100%)',
        }}
      />
      {/* Status bar background for iOS safe area */}
      <TopStatusBackground />
      {/* Language Switcher - top right */}
      <div
        className="fixed right-4 z-50"
        style={{ top: 'calc(env(safe-area-inset-top) + 28px)' }}
      >
        <LanguageSwitcher />
      </div>

      {/* Main Content with Enhanced Animations */}
      {(seenLanding !== false || assetsReady) ? (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          {...fadeInUp}
          className="flex-1 flex flex-col items-center justify-center relative z-20 px-6 content-wrapper"
          style={{ 
            height: 'calc(100% - 100px)',
            minHeight: 'min-content'
          }}
        >

          {/* Optional illustration for specific slides */}
          {currentSlide === 0 && (
            <motion.img
              src={WelcomeVector}
              alt={t(slides[0].altKey)}
              {...fadeInUp}
              transition={{ ...transition, delay: 0 }}
              loading="eager"
              className="w-40 h-40 sm:w-48 sm:h-48 object-contain mb-4 mx-auto"
            />
          )}
          {currentSlide === 1 && (
            <motion.img
              src={MealPlanningVector}
              alt={t(slides[1].altKey)}
              {...fadeInUp}
              transition={{ ...transition, delay: 0 }}
              loading="eager"
              className="w-40 h-40 sm:w-48 sm:h-48 object-contain mb-4 mx-auto"
            />
          )}
          {currentSlide === 2 && (
            <motion.img
              src={WorkoutTrackingVector}
              alt={t(slides[2].altKey)}
              {...fadeInUp}
              transition={{ ...transition, delay: 0 }}
              loading="eager"
              className="w-40 h-40 sm:w-48 sm:h-48 object-contain mb-4 mx-auto"
            />
          )}
          {currentSlide === 3 && (
            <motion.img
              src={AIAnalysisVector}
              alt={t(slides[3].altKey)}
              {...fadeInUp}
              transition={{ ...transition, delay: 0 }}
              loading="eager"
              className="w-40 h-40 sm:w-48 sm:h-48 object-contain mb-4 mx-auto"
            />
          )}

          {/* Text Content with light stagger */}
          <motion.div 
            {...fadeInUp}
            transition={{ ...transition, delay: 0 }}
            className="text-center space-y-2 mt-2"
          >
            <motion.h1 
              {...fadeInUp}
              transition={{ ...transition, delay: 0.05 }}
              className="text-2xl sm:text-3xl font-bold text-black mb-2 font-inter"
            >
              {t(slides[currentSlide].titleKey)}
            </motion.h1>
            <motion.p 
              {...fadeScale}
              transition={{ ...transition, delay: 0.1 }}
              className="text-sm sm:text-base tracking-wide font-medium font-inter text-gray-700"
            >
              {t(slides[currentSlide].descriptionKey)}
            </motion.p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      ) : (
        // Lightweight splash while assets preload on first visit
        <div className="flex-1 flex items-center justify-center relative z-20 px-6">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-gray-300 border-t-black animate-spin mx-auto mb-3" />
            <p className="text-gray-600 text-sm">{t('common.loading') ?? 'Loading...'}</p>
          </div>
        </div>
      )}

      {/* Bottom Panel with solid white bottom and top fade to blend with content */}
      {(seenLanding !== false || assetsReady) && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white rounded-t-[32px] px-6 py-6 relative z-20 bottom-panel"
        style={{
          height: '100px',
          willChange: 'opacity',
          backfaceVisibility: 'hidden'
        }}
      >
        {/* Top gradient overlay to ensure smooth blend into content while keeping bottom pure white */}
        <div
          className="pointer-events-none absolute -top-8 left-0 right-0 h-8 rounded-t-[32px]"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 100%)'
          }}
        />
        <div className="max-w-[300px] mx-auto h-full flex items-center">
          <motion.button
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
            onClick={handleNext}
            disabled={isTransitioning}
            className="w-full bg-black text-white rounded-full py-3 px-4 flex items-center justify-center space-x-2 font-medium font-inter disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <motion.span
              key={currentSlide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {currentSlide === slides.length - 1 ? t('landing.cta.get_started') : t('landing.cta.continue')}
            </motion.span>
          </motion.button>
        </div>
      </motion.div>
      )}
    </div>
  );
};

const shimmerKeyframes = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1) rotate(0deg);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2) rotate(180deg);
    opacity: 0.8;
  }
  100% {
    transform: scale(1) rotate(360deg);
    opacity: 0.5;
  }
}
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = shimmerKeyframes;
document.head.appendChild(styleSheet);

export default Landing; 