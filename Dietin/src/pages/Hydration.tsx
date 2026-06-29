import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Utensils, Flame, Activity, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";
import HydrationTracker from "@/components/HydrationTracker";
import HydrationAI from "@/components/hydration ai";
import { useUserStore } from "@/stores/userStore";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const Hydration = () => {
  const { user } = useUserStore();
  const { t } = useTranslation();
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [isAddingWorkout, setIsAddingWorkout] = useState(false);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);

  // Default values for hydration AI
  const defaultValues = {
    remainingCalories: user?.calorieGoal || 2000,
    remainingProtein: user?.proteinGoal || 150,
    remainingCarbs: user?.carbsGoal || 200,
    remainingFat: user?.fatGoal || 67,
    currentTime: new Date(),
    budget: "moderate"
  };

  return (
    <div className={cn("h-screen", (isAddingWorkout || isProPanelOpen) && "fixed inset-0")}>
      <div className="h-full overflow-y-auto -webkit-overflow-scrolling-touch">
        <div className="container mx-auto space-y-6 p-6 pb-24">
          <div className="flex flex-col gap-3">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-[1.75rem] tracking-tight text-black font-sf-display font-sf-bold"
            >
              {t('hydration.title')}
            </motion.h1>

            {user && (
              <div className="flex justify-center w-full -mt-1">
                <div className="bg-gray-100 rounded-full p-1 flex items-center shadow-md border border-gray-200/50">
                  <Link
                    to="/diet"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('nav.diet')}</span>
                    <Utensils className="w-4 h-4 text-gray-600" />
                  </Link>
                  <Link
                    to="/burn"
                    className="px-5 py-2 rounded-full flex items-center gap-2.5 transition-all duration-200 hover:bg-white/70"
                  >
                    <span className="text-sm font-medium text-gray-600">{t('nav.burn')}</span>
                    <Flame className="w-4 h-4 text-gray-600" />
                  </Link>
                  <Link
                    to="/hydration"
                    className="px-5 py-2 rounded-full bg-white shadow-sm flex items-center gap-2.5 transition-all duration-200 border border-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">{t('nav.hydration')}</span>
                    <Droplet className="w-4 h-4 text-primary" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow-lg border border-black/5 rounded-3xl overflow-hidden">
            <HydrationTracker setIsPopupOpen={setSelectedDrink} />
          </div>

          <HydrationAI 
            remainingCalories={defaultValues.remainingCalories}
            remainingProtein={defaultValues.remainingProtein}
            remainingCarbs={defaultValues.remainingCarbs}
            remainingFat={defaultValues.remainingFat}
            currentTime={defaultValues.currentTime}
            budget={defaultValues.budget}
            selectedDrink={selectedDrink}
            setSelectedDrink={setSelectedDrink}
          />
        </div>
      </div>
    </div>
  );
};

export default Hydration; 