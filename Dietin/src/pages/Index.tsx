import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/userStore";
import { Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import ProSubscriptionPanel from '@/components/ProSubscriptionPanel';
import AnalyticsDisplay from '@/components/AnalyticsDisplay';
import { format, addDays, isSameDay } from "date-fns";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import NavHide from '@/components/NavHide';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface IndexProps { }

const styles = `
@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes noise {
  0% { transform: translate(0, 0) }
  10% { transform: translate(-2%, -2%) }
  20% { transform: translate(-4%, 2%) }
  30% { transform: translate(2%, -4%) }
  40% { transform: translate(-2%, 6%) }
  50% { transform: translate(-4%, 2%) }
  60% { transform: translate(6%, 0) }
  70% { transform: translate(0, 4%) }
  80% { transform: translate(-6%, 0) }
  90% { transform: translate(4%, 2%) }
  100% { transform: translate(0, 0) }
}
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

const Index = ({ }: IndexProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, getDailyCalories } = useUserStore();
  const { currentStreak } = useAnalyticsStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showConsumed, setShowConsumed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dailyData = getDailyCalories(format(selectedDate, "yyyy-MM-dd"));

  const calorieGoal = user?.calorieGoal || 2000;
  const consumedCalories = dailyData?.totalCalories || 0;
  const remainingCalories = calorieGoal - consumedCalories;

  // Macro goals from user profile or defaults for non-logged users
  const proteinGoal = user?.proteinGoal || 150; // 30% of calories from protein
  const carbsGoal = user?.carbsGoal || 200; // 40% of calories from carbs
  const fatGoal = user?.fatGoal || 67; // 30% of calories from fat

  // Calculate progress percentages
  const proteinProgress = ((dailyData?.totalProtein || 0) / (proteinGoal || 1)) * 100;
  const carbsProgress = ((dailyData?.totalCarbs || 0) / (carbsGoal || 1)) * 100;
  const fatProgress = ((dailyData?.totalFat || 0) / (fatGoal || 1)) * 100;

  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [currentNutrientPage, setCurrentNutrientPage] = useState(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragOffset = useRef(0);
  const nutrientContainerRef = useRef<HTMLDivElement>(null);

  // Function to calculate total of additional nutrients
  const getTotalNutrient = (nutrientName: string): number => {
    if (!dailyData?.entries || dailyData.entries.length === 0) return 0;

    const total = dailyData.entries.reduce((sum, entry) => {
      // @ts-ignore - We know these properties might exist
      const value = entry[nutrientName] || 0;
      return sum + value;
    }, 0);

    // Round to appropriate decimal places based on nutrient type
    if (['cholesterol', 'sodium', 'potassium', 'magnesium'].includes(nutrientName)) {
      return Math.round(total); // Round to whole number for mg values
    } else if (['vitaminA', 'vitaminC', 'calcium', 'iron'].includes(nutrientName)) {
      return Math.round(total); // Round to whole number for percentage values
    } else {
      return Math.round(total * 10) / 10; // Round to 1 decimal place for g values
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Removed search and AI assistant related logic

  // Generate calendar days
  const generateDays = () => {
    const days = [];
    const today = new Date();

    // Generate last 3 days and next 3 days (7 days total)
    for (let i = -3; i <= 3; i++) {
      const date = addDays(today, i);
      const formattedDate = format(date, "yyyy-MM-dd");
      const dayData = getDailyCalories(formattedDate);
      days.push({
        date,
        calories: dayData?.totalCalories || 0,
        entries: dayData?.entries || [],
        isCurrentMonth: true
      });
    }

    return days;
  };

  const days = generateDays();

  const nutrientPages = [
    // Page 2
    [
      { name: "sugar", value: getTotalNutrient('sugar'), unit: "g" },
      { name: "fiber", value: getTotalNutrient('fiber'), unit: "g" },
      { name: "cholesterol", value: getTotalNutrient('cholesterol'), unit: "mg" }
    ],
    // Page 3
    [
      { name: "sodium", value: getTotalNutrient('sodium'), unit: "mg" },
      { name: "potassium", value: getTotalNutrient('potassium'), unit: "mg" },
      { name: "magnesium", value: getTotalNutrient('magnesium'), unit: "mg" }
    ],
    // Page 4
    [
      { name: "vitamin_a", value: getTotalNutrient('vitaminA'), unit: "%" },
      { name: "vitamin_c", value: getTotalNutrient('vitaminC'), unit: "%" },
      { name: "iron", value: getTotalNutrient('iron'), unit: "%" }
    ]
  ];

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!user?.isPro) return;
    const touch = 'touches' in e ? e.touches[0] : e;
    dragStartX.current = touch.clientX;
    isDragging.current = true;
    dragOffset.current = 0;
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !user?.isPro) return;
    const touch = 'touches' in e ? e.touches[0] : e;
    dragOffset.current = touch.clientX - dragStartX.current;
  };

  const handleDragEnd = () => {
    if (!isDragging.current || !user?.isPro) return;
    isDragging.current = false;

    const isRTL = document.dir === 'rtl';
    const threshold = 50;
    const direction = isRTL ? -1 : 1;

    if (Math.abs(dragOffset.current) > threshold) {
      if ((dragOffset.current * direction) > 0 && currentNutrientPage > 0) {
        setCurrentNutrientPage(prev => prev - 1);
      } else if ((dragOffset.current * direction) < 0 && currentNutrientPage < nutrientPages.length) {
        setCurrentNutrientPage(prev => prev + 1);
      }
    }
    dragOffset.current = 0;
  };

  const getTransformStyle = () => {
    const isRTL = document.dir === 'rtl';
    const baseTransform = `translateX(${isRTL ? '' : '-'}${currentNutrientPage * 100}%)`;
    const dragTransform = dragOffset.current ? `translateX(${dragOffset.current}px)` : '';

    return {
      transform: `${baseTransform} ${dragTransform}`,
      WebkitTransform: `${baseTransform} ${dragTransform}`,
      msTransform: `${baseTransform} ${dragTransform}`,
      transition: isDragging.current ? 'none' : 'transform 0.3s ease-out'
    } as const;
  };

  return (
    <div className="h-full">
      <div className="h-full overflow-y-auto -webkit-overflow-scrolling-touch">
        <motion.div
          className="container mx-auto p-6 pb-24 space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: mounted ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header Section */}
          <div className="flex justify-between items-center">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: mounted ? 1 : 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-[1.75rem] tracking-tight font-sf-display font-sf-bold relative flex items-baseline gap-2"
            >
              <span className="text-black">{user ? t('common.welcome_user', { name: '' }) : t('common.welcome')}</span>
              <span
                className="relative"
                style={user?.isPro ? {
                  background: `linear-gradient(90deg, #3b82f6, #6366f1, #ec4899, #3b82f6)`,
                  backgroundSize: "200% 200%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "gradient 8s linear infinite",
                  textShadow: "0 0 40px rgba(255,255,255,0.1)"
                } : {
                  color: "black"
                }}
              >
                {user?.name}
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: mounted ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex items-center gap-3"
            >
              {/* DietinPro Button - Only for logged-in non-pro users */}
              {user && !user.isPro && (
                <button
                  onClick={() => navigate('/payment')}
                  className="relative h-10 w-10 rounded-full bg-white flex items-center justify-center group overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 group-hover:scale-110 transition-transform duration-300">
                    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
                  </svg>
                </button>
              )}
            </motion.div>
          </div>

          {/* Calendar Section */}
          <motion.div
            className="space-y-2 -mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Calendar Grid */}
            <div>
              {/* Week days header */}
              <div className="grid grid-cols-7 gap-4">
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-[11px] font-medium text-black/90"
                  >
                    {t(`days.${day}`)}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-4 mt-2">
                {days.map((day, i) => (
                  <motion.button
                    key={format(day.date, "yyyy-MM-dd")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDate(day.date)}
                    className="relative aspect-square"
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative w-full h-full flex items-center justify-center">
                        <div className={cn(
                          "absolute inset-[10%] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.03)]",
                          isSameDay(day.date, selectedDate) ? "bg-cyan-100" : "bg-white"
                        )} />
                        <svg className="absolute w-full h-full -rotate-90">
                          <circle
                            cx="50%"
                            cy="50%"
                            r="45%"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            className="text-gray-200"
                          />
                          {day.calories > 0 && (
                            <circle
                              cx="50%"
                              cy="50%"
                              r="45%"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 45}`}
                              strokeDashoffset={`${2 * Math.PI * 45 * (1 - Math.min((day.calories / calorieGoal) * 100, 100) / 100)}`}
                              className={cn(
                                "transition-all duration-300",
                                isSameDay(day.date, selectedDate) ? "text-cyan-500" : "text-cyan-400"
                              )}
                            />
                          )}
                        </svg>
                        <div className="text-center relative z-10">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={`${format(day.date, "yyyy-MM-dd")}-${day.calories}`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              className={cn(
                                "text-xs font-medium",
                                isSameDay(day.date, selectedDate) ? "text-cyan-600" : "text-gray-900"
                              )}
                            >
                              {day.calories > 0 ? Math.round(day.calories) : '0'}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Calories Circle */}
          <div className="relative flex justify-center mt-4">
            {/* Main Circle */}
            <div
              className="relative w-60 h-60 flex items-center justify-center cursor-pointer"
              onClick={() => setShowConsumed(!showConsumed)}
            >
              <div className="absolute inset-[5%] rounded-full bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]" />
              <svg className="absolute w-full h-full -rotate-90">
                <circle
                  cx="120"
                  cy="120"
                  r="112"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-gray-100"
                />
                <motion.circle
                  cx="120"
                  cy="120"
                  r="112"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 112}`}
                  initial={false}
                  animate={{
                    strokeDashoffset: `${2 * Math.PI * 112 * (1 - (showConsumed ? (consumedCalories / calorieGoal) : ((calorieGoal - remainingCalories) / calorieGoal)))}`,
                  }}
                  transition={{
                    duration: 0.6,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  className={cn(
                    "transition-all duration-300",
                    consumedCalories > calorieGoal ? "text-red-500" : "text-blue-500"
                  )}
                />
              </svg>
              <div className="text-center relative z-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={showConsumed ? 'consumed' : 'remaining'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                  >
                    <div className="text-5xl font-bold text-gray-900 font-['EB_Garamond'] tracking-tight">
                      {showConsumed ? consumedCalories : remainingCalories}
                    </div>
                    <div className="text-sm text-gray-500">
                      {showConsumed ? t('diet.consumed') : t('diet.kcal_left')}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Macronutrients Card */}
          <div className="mt-4 bg-white backdrop-blur-sm border border-black/5 rounded-3xl p-4 shadow-lg hover:bg-white/95 transition-colors">
            <div className="overflow-hidden relative">
              <motion.div
                ref={nutrientContainerRef}
                className="relative w-full"
                onMouseDown={(e) => user?.isPro && handleDragStart(e)}
                onMouseMove={(e) => user?.isPro && handleDragMove(e)}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={(e) => user?.isPro && handleDragStart(e)}
                onTouchMove={(e) => user?.isPro && handleDragMove(e)}
                onTouchEnd={handleDragEnd}
                style={{ touchAction: 'pan-y pinch-zoom' }}
              >
                <div
                  className="flex flex-nowrap"
                  style={getTransformStyle()}
                >
                  {/* Original macros display - always visible */}
                  <div className="min-w-full shrink-0">
                    <div className="grid grid-cols-3 gap-4 px-2">
                      <div className="text-center">
                        <div className="text-sm font-medium text-black/60 mb-2 truncate">{t('diet.carbs')}</div>
                        <div className="text-base font-semibold text-black">{dailyData?.totalCarbs || 0}/{carbsGoal}g</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-black/60 mb-2 truncate">{t('diet.protein')}</div>
                        <div className="text-base font-semibold text-black">{dailyData?.totalProtein || 0}/{proteinGoal}g</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-black/60 mb-2 truncate">{t('diet.fat')}</div>
                        <div className="text-base font-semibold text-black">{dailyData?.totalFat || 0}/{fatGoal}g</div>
                      </div>
                    </div>
                  </div>

                  {/* Additional nutrient pages */}
                  {nutrientPages.map((page, pageIndex) => (
                    <div key={`nutrient-page-${pageIndex}`} className="min-w-full shrink-0">
                      <div className="grid grid-cols-3 gap-4 px-2">
                        {page.map((nutrient, index) => (
                          <div key={`${pageIndex}-${index}`} className="text-center">
                            <div className="text-sm font-medium text-black/60 mb-2 truncate">{t(`nutrients.${nutrient.name.toLowerCase()}`)}</div>
                            <div className="text-base font-semibold text-black whitespace-nowrap">
                              {nutrient.value || 0}{nutrient.unit}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Pro subscription overlay */}
              {currentNutrientPage > 0 && !user?.isPro && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-gradient-to-br from-amber-50/95 to-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-4 text-center z-50"
                  >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg">
                      <Lock className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">{t('home.unlock_pro')}</h3>
                  </motion.div>
                </>
              )}
            </div>

            {/* Pagination dots - only show for pro users */}
            {user?.isPro && (
              <div className="flex justify-center gap-1.5 mt-4">
                {[0, ...Array(nutrientPages.length).keys()].map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      currentNutrientPage === index
                        ? "bg-black/60"
                        : "bg-black/20"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Analytics Display */}
          <AnalyticsDisplay setIsProPanelOpen={setIsProPanelOpen} />
        </motion.div>
      </div>

      <NavHide isAIOpen={false} />
      <ProSubscriptionPanel isOpen={isProPanelOpen} onClose={() => setIsProPanelOpen(false)} />
    </div>
  );
};

export default Index;