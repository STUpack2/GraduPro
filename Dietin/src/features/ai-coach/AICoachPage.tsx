import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { AICoachPanel } from "./AICoachPanel";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AICoachPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className={cn("h-screen")}>
      <div className="h-full overflow-y-auto -webkit-overflow-scrolling-touch">
        <div className="container mx-auto space-y-6 p-6 pb-24">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-[1.75rem] tracking-tight text-black dark:text-white font-sf-display font-sf-bold m-0"
            >
              {t('nav.aiCoach', { defaultValue: 'AI Coach' })}
            </motion.h1>
          </div>

          <div className="w-full">
            <AICoachPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
