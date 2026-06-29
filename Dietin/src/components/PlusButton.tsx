import { motion, AnimatePresence, PanInfo, useMotionValue } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Utensils, Dumbbell, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";


interface PlusButtonProps {
  isOpen: boolean;
  onClose: () => void;
  setIsMealAnalysisOpen: (open: boolean) => void;
  setIsCustomPlanOpen: (open: boolean) => void;
}

const PlusButton = ({ isOpen, onClose, setIsMealAnalysisOpen, setIsCustomPlanOpen }: PlusButtonProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const y = useMotionValue(0);
  const { t } = useTranslation();

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
    setIsDragging(false);
  };

  const handleMealLoggingClick = () => {
    onClose();
    // Keep nav hidden during transition
    setTimeout(() => {
      setIsMealAnalysisOpen(true);
    }, 300);
  };

  const handleWorkoutPlanClick = () => {
    onClose();
    if (location.pathname === '/plan') {
      // If already on plan page, just trigger the button click
      const createPlanButton = document.querySelector('[data-create-plan-button]');
      if (createPlanButton) {
        setTimeout(() => {
          (createPlanButton as HTMLElement).click();
        }, 100);
      }
    } else {
      // If not on plan page, store flag and navigate
      localStorage.setItem('shouldOpenCustomPlan', 'true');
      navigate("/plan");
    }
  };


  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
            onClick={onClose}
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
            onDragEnd={(event, info) => {
              if (info.offset.y > 100) {
                onClose();
              } else {
                y.set(0);
              }
              setIsDragging(false);
            }}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-[99999]"
          >
            <motion.div
              className="bg-[#f5f5f7] dark:bg-[#1c1c1e] rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] relative flex flex-col"
              animate={{
                height: "22vh"
              }}
              transition={{
                duration: 0.6,
                ease: [0.23, 1, 0.32, 1]
              }}
            >
              <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                <div className="w-10 h-1 bg-black/10 dark:bg-white/20 rounded-full" />
              </div>
              
              <motion.div
                key="options"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex-1 overflow-y-auto overscroll-contain px-4 ${isDragging ? "pointer-events-none" : ""}`}
              >
                <div className="grid grid-cols-2 gap-2.5 py-2">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={handleWorkoutPlanClick}
                    className="bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <Dumbbell className="w-6 h-6 text-[#007AFF]" />
                    <span className="text-sm font-medium text-[#1d1d1f] dark:text-white/90">{t('plusButton.workoutPlan')}</span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={handleMealLoggingClick}
                    className="bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-200"
                  >
                    <Utensils className="w-6 h-6 text-[#007AFF]" />
                    <span className="text-sm font-medium text-[#1d1d1f] dark:text-white/90">{t('plusButton.mealLogging')}</span>
                  </motion.button>

                </div>
              </motion.div>
              {/** bottom-only white gradient overlay for popup container */}
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white" />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PlusButton; 