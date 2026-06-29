import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Sparkles, X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ImproveAIProps {
  onClick: () => void;
  className?: string;
  analysisResult?: any;
  onImprove?: (improveText: string) => Promise<void>;
}

const ImproveAI = ({ onClick, className, analysisResult, onImprove }: ImproveAIProps) => {
  const { t, i18n } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [improveText, setImproveText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      setIsDialogOpen(false);
    } else {
      y.set(0);
    }
    setIsDragging(false);
  };

  const handleImprove = async () => {
    if (!improveText.trim() || !onImprove) return;
    
    try {
      setIsLoading(true);
      // Ensure AI response language matches current UI language
      const isArabic = (i18n.language || "").toLowerCase().startsWith("ar");
      const languageInstruction = isArabic
        ? "IMPORTANT: Reply in Arabic (Egyptian dialect - ar-EG). Keep numbers as numbers."
        : "IMPORTANT: Reply in English. Keep numbers as numbers.";

      const finalImproveText = `${improveText}\n\n${languageInstruction}`;

      await onImprove(finalImproveText);
      setIsDialogOpen(false);
      setImproveText("");
    } catch (error) {
      console.error("Failed to improve:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsDialogOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative h-12 w-12 rounded-full border border-white/10 overflow-hidden",
          "flex items-center justify-center group",
          className
        )}
      >
        <motion.div
          animate={{ 
            backgroundPosition: ["0% 0%", "100% 100%", "200% 200%"],
          }}
          transition={{ 
            duration: 5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear"
          }}
          className="absolute inset-0 bg-gradient-to-br from-[#FF3366] via-[#7B3CFF] to-[#0055FF] bg-[length:200%_200%]"
        />
        <motion.div
          className="absolute inset-0 bg-black/5 backdrop-blur-sm"
        />
        <div className="relative z-10">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      </motion.button>

      <AnimatePresence>
        {isDialogOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/50 backdrop-blur-xl z-[999999] pointer-events-auto"
              style={{ position: 'fixed', transform: 'translate3d(0,0,0)' }}
              onClick={() => !isLoading && setIsDialogOpen(false)}
            />
            <motion.div
              style={{ opacity, position: 'fixed', transform: 'translate3d(0,0,0)' }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.6}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              className="fixed left-4 right-4 bottom-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] rounded-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] z-[999999]"
            >
              <div className="pt-3 pb-2 flex justify-center">
                <div className="w-10 h-1 bg-black/10 dark:bg-white/20 rounded-full" />
              </div>

              <div className={cn(
                "px-4 pb-4",
                isDragging && "pointer-events-none"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => !isLoading && setIsDialogOpen(false)}
                    className="text-[#007AFF] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('improveAI.close')}
                  </button>
                  <h3 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">{t('improveAI.title')}</h3>
                  <div className="w-[52px]" />
                </div>
                
                <textarea
                  value={improveText}
                  onChange={(e) => setImproveText(e.target.value)}
                  disabled={isLoading}
                  placeholder={t('improveAI.placeholder')}
                  className="w-full h-32 px-4 py-3 rounded-xl bg-white/80 dark:bg-white/10 border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] text-[#1d1d1f] dark:text-white/90 transition-all duration-200 resize-none disabled:opacity-50"
                />

                <div className="mt-4">
                  <button
                    onClick={handleImprove}
                    disabled={!improveText.trim() || isLoading}
                    className={cn(
                      "w-full h-12 rounded-xl font-medium transition-all duration-300",
                      "bg-gradient-to-r from-[#007AFF] to-[#0055FF] text-white",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "hover:from-[#0066FF] hover:to-[#0044FF]",
                      "active:scale-[0.98]",
                      "shadow-lg shadow-blue-500/25",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        {t('improveAI.improving')}
                      </>
                    ) : (
                      t('improveAI.improve')
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ImproveAI; 