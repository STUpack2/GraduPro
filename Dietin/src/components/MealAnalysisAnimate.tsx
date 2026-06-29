import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { ReactNode } from "react";

interface MealAnalysisAnimateProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const MealAnalysisAnimate = ({ isOpen, onClose, children }: MealAnalysisAnimateProps) => {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    } else {
      y.set(0);
    }
  };

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
              duration: 0.6,
              ease: [0.23, 1, 0.32, 1]
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0}
            dragTransition={{ bounceStiffness: 0, bounceDamping: 0 }}
            dragMomentum={false}
            onDrag={(e, { delta, offset }) => {
              if (offset.y < 0) {
                (e.target as HTMLElement).style.transform = `translateY(0px)`;
              }
            }}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'none' }}
            className="fixed bottom-0 left-0 right-0 z-[99999] touch-none select-none overscroll-none"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MealAnalysisAnimate; 