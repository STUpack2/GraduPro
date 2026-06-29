import { useState, useEffect, useMemo, useLayoutEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUserStore } from "@/stores/userStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  ChevronRight,
  ChevronLeft,
  Settings,
  Mail,
  Lock,
  Bell,
  LogOut,
  Heart,
  Calendar,
  Scale,
  CreditCard,
  HelpCircle,
  Star,
  Save,
  Smile,
  BarChart,
  Crown,
  Clock,
  Zap,
  FileText,
  Copy,
  Camera,
  Brain,
  ChartBar,
  Sparkles,
  Languages
} from "lucide-react";
import { format } from "date-fns";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { toast } from "sonner";
import SettingsPanel from "@/components/SettingsPanel";
import { cn } from "@/lib/utils";
import BMIIndicator from "@/components/BMIIndicator";
import ProgressChart from "@/components/ProgressChart";
import MoodCalendar from "@/components/MoodCalendar";
import MacroBarChart from "@/components/MacroBarChart";
import MuscleRadarChart from "@/components/MuscleRadarChart";
import { Link, useNavigate } from "react-router-dom";
import NavHide from "@/components/NavHide";
import { useTranslation } from "react-i18next";
import ProSubscriptionPanel from "@/components/ProSubscriptionPanel";
import { getStoredTheme, setTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme";

const Profile = () => {
  const { user, updateUser, checkAndResetQuotas } = useUserStore();
  const navigate = useNavigate();
  const isGuest = !auth.currentUser?.uid;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initialView, setInitialView] = useState('profile');
  const [isMeasurementsOpen, setIsMeasurementsOpen] = useState(false);
  const [isHealthGoalsOpen, setIsHealthGoalsOpen] = useState(false);
  const [isMoodTrackerOpen, setIsMoodTrackerOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const [isProSubscriptionPanelOpen, setIsProSubscriptionPanelOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [joinDate, setJoinDate] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { t, i18n } = useTranslation();
  // Local UI state for immediate toggle animation
  const [moodEnabled, setMoodEnabled] = useState<boolean>(user?.isMoodTrackerEnabled ?? true);
  // Theme state (local only)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try { return getStoredTheme(); } catch { return 'light'; }
  });

  useEffect(() => {
    const onThemeChange = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { mode?: ThemeMode } | undefined;
        if (detail?.mode) setThemeMode(detail.mode);
        else setThemeMode(getStoredTheme());
      } catch { }
    };
    window.addEventListener('themechange', onThemeChange as EventListener);
    return () => window.removeEventListener('themechange', onThemeChange as EventListener);
  }, []);
  const [goals, setGoals] = useState({
    calories: user?.calorieGoal || 2000,
    protein: user?.proteinGoal || 150,
    carbs: user?.carbsGoal || 200,
    fat: user?.fatGoal || 70
  });
  const [subscriptionData, setSubscriptionData] = useState<{
    expiryDate?: Date;
    dailyQuota: {
      imageAnalysis: number;
      mealAnalysis: number;
    };
    nextReset: Date;
  }>({
    dailyQuota: {
      imageAnalysis: 0,
      mealAnalysis: 0
    },
    nextReset: new Date()
  });

  // Fetch user's join date from Firestore and Auth metadata with local caching
  useEffect(() => {
    const cacheKeyRaw = 'profile.createdAt.raw';
    const cachedRaw = localStorage.getItem(cacheKeyRaw);

    // If we have a cached raw date, format locally according to language (no network)
    if (cachedRaw) {
      const d = new Date(cachedRaw);
      const formatted = d.toLocaleDateString(i18n.language || undefined, { month: 'long', year: 'numeric' });
      setJoinDate(formatted);
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser?.uid) return;
      try {
        // If we already have cached raw, don't hit Firestore again
        if (!localStorage.getItem(cacheKeyRaw)) {
          const userRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userRef);

          let createdAtValue: any = undefined;
          if (userDoc.exists() && (userDoc.data() as any).createdAt) {
            createdAtValue = (userDoc.data() as any).createdAt;
          } else if (currentUser.metadata?.creationTime) {
            createdAtValue = currentUser.metadata.creationTime;
          }

          if (createdAtValue) {
            // Normalize to Date
            let date: Date;
            if (typeof createdAtValue === 'object' && createdAtValue?.toDate) {
              date = createdAtValue.toDate();
            } else if (typeof createdAtValue === 'object' && typeof createdAtValue.seconds === 'number') {
              date = new Date(createdAtValue.seconds * 1000);
            } else {
              date = new Date(createdAtValue);
            }

            // Cache raw ISO once
            const iso = date.toISOString();
            localStorage.setItem(cacheKeyRaw, iso);

            // Show immediately (reformatted per language)
            const formatted = date.toLocaleDateString(i18n.language || undefined, { month: 'long', year: 'numeric' });
            setJoinDate(formatted);

            // Backfill Firestore if missing
            if (!(userDoc.exists() && (userDoc.data() as any).createdAt)) {
              try {
                await updateDoc(userRef, { createdAt: iso });
              } catch (_) {
                // ignore if doc doesn't exist or rules prevent
              }
            }
          }
        } else {
          // We already set from cache above; nothing else to do
        }
      } catch (error) {
        console.error('Error fetching join date:', error);
        // Fallback: if still nothing and we have auth creationTime, use it and cache
        if (!localStorage.getItem(cacheKeyRaw) && currentUser?.metadata?.creationTime) {
          const d = new Date(currentUser.metadata.creationTime);
          localStorage.setItem(cacheKeyRaw, d.toISOString());
          const formatted = d.toLocaleDateString(i18n.language || undefined, { month: 'long', year: 'numeric' });
          setJoinDate(formatted);
        }
      }
    });
    return () => unsubscribe();
  }, [i18n.language]);

  // Fetch subscription data from Firestore and set up real-time listener
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    // Initial quota check
    checkAndResetQuotas();

    // Set up real-time listener for quota updates
    const unsubscribe = onSnapshot(doc(db, "users", currentUser.uid), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setSubscriptionData(prev => ({
          ...prev,
          expiryDate: data.proExpiryDate ? new Date(data.proExpiryDate) : undefined,
          dailyQuota: {
            imageAnalysis: data.dailyImageAnalysis || 0,
            mealAnalysis: data.dailyMealAnalysis || 0
          },
          nextReset: data.lastQuotaReset ? new Date(data.lastQuotaReset) : new Date()
        }));
      }
    }, (error) => {
      console.error('Error in quota sync:', error);
      // Fallback to local storage data if Firestore sync fails
      const localData = localStorage.getItem('user-storage');
      if (localData) {
        try {
          const parsedData = JSON.parse(localData);
          setSubscriptionData(prev => ({
            ...prev,
            dailyQuota: {
              imageAnalysis: parsedData.state.dailyImageAnalysis || 0,
              mealAnalysis: parsedData.state.dailyMealAnalysis || 0
            },
            nextReset: parsedData.state.lastQuotaReset ? new Date(parsedData.state.lastQuotaReset) : new Date()
          }));
        } catch (e) {
          console.error('Error parsing local storage:', e);
        }
      }
    });

    // Check quotas periodically (every minute)
    const quotaInterval = setInterval(() => {
      checkAndResetQuotas();
    }, 60000);

    // Clean up
    return () => {
      unsubscribe();
      clearInterval(quotaInterval);
    };
  }, [checkAndResetQuotas]);

  const SupportView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.support.title')}</h1>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsSettingsOpen(false)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </motion.button>

      <div className="space-y-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 overflow-hidden">
          {/* Privacy Policy */}
          <a
            href="https://dietin.fit/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-4 truncate">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-[15px] font-medium text-gray-900 truncate">{t('profile.profilePage.support.privacy')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </a>

          {/* Terms of Service */}
          <a
            href="https://dietin.fit/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3.5 truncate">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[15px] font-medium text-gray-900 truncate">{t('profile.profilePage.support.terms')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </a>

          {/* Contact Us */}
          <a
            href="mailto:support@dietin.fit"
            className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-3.5 truncate">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-[15px] font-medium text-gray-900 truncate">{t('profile.profilePage.support.contact')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </a>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Mail className="w-4 h-4 text-amber-600" />
              </div>
              <div className="truncate">
                <span className="text-[15px] font-medium text-gray-900 truncate">support@dietin.fit</span>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{t('profile.profilePage.support.responseTime')}</p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('support@dietin.fit');
                toast.success(t('profile.profilePage.support.emailCopied'));
              }}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const menuItems = [
    {
      section: t('profile.profilePage.menu.account'),
      items: [
        {
          id: 'personalInfo', icon: User, label: t('profile.profilePage.menu.personalInfo'), sublabel: t('profile.profilePage.menu.personalInfoSub'), onClick: () => {
            setInitialView('profile');
            setIsSettingsOpen(true);
          }
        },
        {
          id: 'notifications', icon: Bell, label: t('profile.profilePage.menu.notifications'), sublabel: t('profile.profilePage.menu.notificationsSub'), onClick: () => {
            setInitialView('notifications');
            setIsSettingsOpen(true);
          }
        },
        {
          id: 'language', icon: Languages, label: t('profile.profilePage.menu.language'), sublabel: t('profile.profilePage.menu.languageSub'), onClick: () => {
            setInitialView('language');
            setIsSettingsOpen(true);
          }
        },
        {
          id: 'security', icon: Lock, label: t('profile.profilePage.menu.privacy'), sublabel: t('profile.profilePage.menu.privacySub'), onClick: () => {
            setInitialView('security');
            setIsSettingsOpen(true);
          }
        }
      ]
    },
    {
      section: t('profile.profilePage.menu.health'),
      items: [
        { id: 'measurements', icon: Scale, label: t('profile.profilePage.menu.measurements'), sublabel: t('profile.profilePage.menu.measurementsSub'), onClick: () => setIsMeasurementsOpen(true) },
        { id: 'healthGoals', icon: Heart, label: t('profile.profilePage.menu.healthGoals'), sublabel: t('profile.profilePage.menu.healthGoalsSub'), onClick: () => setIsHealthGoalsOpen(true) },
        ...(user?.isPro ? [{ id: 'moodTracker', icon: Smile, label: t('profile.profilePage.menu.moodTracker'), sublabel: t('profile.profilePage.menu.moodTrackerSub'), onClick: () => setIsMoodTrackerOpen(true) }] : [] as any),
        { id: 'analytics', icon: BarChart, label: t('profile.profilePage.menu.analytics'), sublabel: t('profile.profilePage.menu.analyticsSub'), onClick: () => setIsAnalyticsOpen(true) }
      ]
    },
    {
      section: t('profile.profilePage.menu.other'),
      items: [
        {
          id: 'subscription',
          icon: CreditCard,
          label: t('profile.profilePage.menu.subscription'),
          sublabel: user?.isPro ? t('profile.profilePage.menu.proMember') : t('profile.profilePage.menu.freePlan'),
          onClick: () => setIsProPanelOpen(true),
          isPro: user?.isPro
        },
        {
          id: 'helpSupport',
          icon: HelpCircle,
          label: t('profile.profilePage.menu.helpSupport'),
          sublabel: t('profile.profilePage.menu.helpSupportSub'),
          onClick: () => {
            setInitialView('support');
            setIsSettingsOpen(true);
          }
        }
      ]
    }
  ];

  // If guest, hide restricted sections
  const filteredMenuItems = isGuest
    ? menuItems.map(section => ({
      ...section,
      items: section.items.filter((item: any) => ![
        'personalInfo',
        'security',
        'measurements',
        'healthGoals',
        'moodTracker',
        'analytics',
        'subscription'
      ].includes((item as any).id))
    })).filter(section => section.items.length > 0)
    : menuItems;

  const handleSaveGoals = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser?.uid) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          calorieGoal: goals.calories,
          proteinGoal: goals.protein,
          carbsGoal: goals.carbs,
          fatGoal: goals.fat,
          lastUpdated: new Date().toISOString()
        });

        updateUser({
          calorieGoal: goals.calories,
          proteinGoal: goals.protein,
          carbsGoal: goals.carbs,
          fatGoal: goals.fat
        });

        setIsEditing(false);
        toast.success(t('profile.profilePage.healthGoals.updateSuccess'));
      }
    } catch (error) {
      console.error("Error updating goals:", error);
      toast.error(t('profile.profilePage.healthGoals.updateFailed'));
    }
  };

  const MeasurementsView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.measurements.title')}</h1>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsMeasurementsOpen(false)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </motion.button>

      <div className="space-y-6">
        <BMIIndicator />
        <ProgressChart />
      </div>
    </div>
  );

  const HealthGoalsView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.healthGoals.title')}</h1>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsHealthGoalsOpen(false)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </motion.button>

      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t('profile.profilePage.healthGoals.nutrition')}</h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {isEditing ? (
                <Save className="w-5 h-5 text-gray-600" onClick={handleSaveGoals} />
              ) : (
                <Settings className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>

          <div className="space-y-6">
            {/* Calories */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">{t('profile.profilePage.healthGoals.dailyCalories')}</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={goals.calories}
                    onChange={(e) => setGoals(prev => ({ ...prev, calories: parseInt(e.target.value) }))}
                    className="w-24 px-3 py-1 text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <span className="text-sm font-semibold">{goals.calories} {t('common.units.kcal')}</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${Math.min(((user?.dailyCalories?.[new Date().toISOString().split('T')[0]]?.totalCalories || 0) / goals.calories) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Protein */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">{t('profile.profilePage.healthGoals.proteinGoal')}</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={goals.protein}
                    onChange={(e) => setGoals(prev => ({ ...prev, protein: parseInt(e.target.value) }))}
                    className="w-24 px-3 py-1 text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <span className="text-sm font-semibold">{goals.protein}{t('common.units.gramShort')}</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                  style={{ width: `${Math.min(((user?.dailyCalories?.[new Date().toISOString().split('T')[0]]?.totalProtein || 0) / goals.protein) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Carbs */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">{t('profile.profilePage.healthGoals.carbsGoal')}</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={goals.carbs}
                    onChange={(e) => setGoals(prev => ({ ...prev, carbs: parseInt(e.target.value) }))}
                    className="w-24 px-3 py-1 text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <span className="text-sm font-semibold">{goals.carbs}{t('common.units.gramShort')}</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-300"
                  style={{ width: `${Math.min(((user?.dailyCalories?.[new Date().toISOString().split('T')[0]]?.totalCarbs || 0) / goals.carbs) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Fat */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">{t('profile.profilePage.healthGoals.fatGoal')}</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={goals.fat}
                    onChange={(e) => setGoals(prev => ({ ...prev, fat: parseInt(e.target.value) }))}
                    className="w-24 px-3 py-1 text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <span className="text-sm font-semibold">{goals.fat}{t('common.units.gramShort')}</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300"
                  style={{ width: `${Math.min(((user?.dailyCalories?.[new Date().toISOString().split('T')[0]]?.totalFat || 0) / goals.fat) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const MoodTrackerView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.mood.title')}</h1>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsMoodTrackerOpen(false)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </motion.button>

      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('profile.profilePage.mood.sectionTitle')}</h3>
              <p className="text-sm text-gray-600 mt-1">{t('profile.profilePage.mood.sectionSubtitle')}</p>
            </div>
            <button
              onClick={() => updateUser({ isMoodTrackerEnabled: !user?.isMoodTrackerEnabled })}
              className={cn(
                "w-12 h-6 rounded-full relative transition-all duration-300",
                user?.isMoodTrackerEnabled ? "bg-primary/20" : "bg-gray-100"
              )}
            >
              <motion.div
                layout
                initial={false}
                animate={{
                  x: user?.isMoodTrackerEnabled ? 24 : 0,
                }}
                className={cn(
                  "absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm",
                  user?.isMoodTrackerEnabled ? "bg-primary" : "bg-gray-400"
                )}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 22
                }}
              />
            </button>
          </div>
        </div>

        <MoodCalendar />
      </div>
    </div>
  );

  const AnalyticsView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.analytics.title')}</h1>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsAnalyticsOpen(false)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </motion.button>

      <div className="space-y-6">
        <MacroBarChart />
        <MuscleRadarChart />
      </div>
    </div>
  );

  const SubscriptionView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.subscription.title')}</h1>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsProPanelOpen(false)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </motion.button>

      <div className="space-y-6">
        {user?.isPro ? (
          // iOS-style Pro subscription card
          <div className="relative rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] overflow-hidden">
            {/* subtle gradient header */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />
            <div className="relative p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center shadow-sm">
                    <Crown className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.subscription.proTitle')}</h3>
                    <p className="text-sm text-gray-600">{t('profile.profilePage.subscription.active')}</p>
                  </div>
                </div>
                {/* Status chip removed as requested */}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200/80 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">{t('profile.profilePage.subscription.startDate')}</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {subscriptionData.expiryDate ?
                      format(new Date(subscriptionData.expiryDate.getTime() - (32 * 24 * 60 * 60 * 1000)), 'MMM d, yyyy') :
                      t('common.na')}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">{t('profile.profilePage.subscription.endDate')}</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {subscriptionData.expiryDate ?
                      format(subscriptionData.expiryDate, 'MMM d, yyyy') :
                      t('common.na')}
                  </p>
                </div>
              </div>

              {/* Time remaining */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{t('profile.profilePage.subscription.timeRemaining')}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {subscriptionData.expiryDate ?
                    `${Math.max(0, Math.ceil((subscriptionData.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} ${t('common.days')}` :
                    t('common.na')}
                </span>
              </div>

              {/* Perks removed as requested */}

              {/* Manage / Restore Purchases removed as requested */}
            </div>
          </div>
        ) : (
          // iOS-style Free plan card
          <div className="rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.06)] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 tracking-[-0.01em]">{t('profile.profilePage.subscription.freeTitle')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('profile.profilePage.subscription.freeSubtitle')}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white border border-black/5 flex items-center justify-center shadow-sm">
                <CreditCard className="w-4.5 h-4.5 text-gray-500" />
              </div>
            </div>

            <div className="space-y-5">
              {/* Image Analysis Quota */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-800">{t('profile.profilePage.subscription.imageAnalysis')}</label>
                  <span className="text-sm font-semibold text-gray-900">{subscriptionData.dailyQuota.imageAnalysis}/1</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${Math.min((subscriptionData.dailyQuota.imageAnalysis / 1) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Meal Analysis Quota */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-800">{t('profile.profilePage.subscription.mealAnalysis')}</label>
                  <span className="text-sm font-semibold text-gray-900">{subscriptionData.dailyQuota.mealAnalysis}/3</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-300"
                    style={{ width: `${Math.min((subscriptionData.dailyQuota.mealAnalysis / 3) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Next Reset */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{t('profile.profilePage.subscription.nextReset')}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {(() => {
                    const lastReset = new Date(subscriptionData.nextReset);
                    const nextReset = new Date(lastReset.getTime() + (6 * 60 * 60 * 1000)); // 6 hours
                    const now = new Date();
                    const hoursUntilReset = Math.ceil((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60));
                    return hoursUntilReset <= 1 ? t('profile.profilePage.subscription.lessThanHour') : t('profile.profilePage.subscription.inHours', { hours: hoursUntilReset });
                  })()}
                </span>
              </div>

              {/* Upgrade CTA */}
              <div className="space-y-3">
                <button
                  onClick={() => setIsProSubscriptionPanelOpen(true)}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-900 hover:bg-black text-white text-sm font-semibold tracking-[-0.01em] transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> {t('profile.profilePage.subscription.upgrade')}
                </button>
                <p className="text-[13px] text-center text-gray-500">
                  {t('profile.profilePage.subscription.cancelAnytime')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Derive a single currentView so we can coordinate transitions and side-effects
  const currentView = useMemo(() => {
    if (isSettingsOpen) return 'settings';
    if (isHealthGoalsOpen) return 'healthgoals';
    if (isMoodTrackerOpen) return 'moodtracker';
    if (isAnalyticsOpen) return 'analytics';
    if (isProPanelOpen) return 'subscription';
    if (isMeasurementsOpen) return 'measurements';
    return 'profile';
  }, [isSettingsOpen, isHealthGoalsOpen, isMoodTrackerOpen, isAnalyticsOpen, isProPanelOpen, isMeasurementsOpen]);

  // When switching sections, reset scroll to top instantly to avoid perceived jump
  useLayoutEffect(() => {
    const scroller = document.querySelector('.profile-scroll') as HTMLElement | null;
    if (scroller) scroller.scrollTop = 0;
  }, [currentView]);

  return (
    <div className="min-h-full">
      <div className="h-full overflow-y-auto pb-safe -webkit-overflow-scrolling-touch profile-scroll" style={{ overflowAnchor: 'none', scrollbarGutter: 'stable both-edges' as any }}>
        {/* Sequence transitions between views; single child ensures no warnings */}
        <AnimatePresence initial={false} mode="wait">
          {(() => {
            return (
              <motion.div
                key={currentView}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={currentView === 'profile' ? 'px-5 py-4 space-y-8 max-w-2xl mx-auto min-h-[70vh]' : 'px-5 py-4 max-w-2xl mx-auto min-h-[70vh]'}
              >
                {currentView === 'profile' && (
                  <>
                    {/* Header */}
                    <div className="flex justify-between items-center pt-2">
                      <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('common.profile')}</h1>
                    </div>

                    {/* Profile Card */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-5">
                      <div className="flex items-center gap-6 text-start">
                        <div className="relative">
                          <Avatar className="h-[72px] w-[72px] ring-4 ring-white/50 relative">
                            {!isGuest && (
                              <AvatarImage src={user?.profilePicture} className="object-cover" />
                            )}
                            <AvatarFallback
                              className={cn(
                                'flex items-center justify-center h-full w-full',
                                isGuest
                                  ? 'bg-gradient-to-br from-gray-200 via-gray-100 to-white border border-gray-200'
                                  : 'bg-gradient-to-br from-purple-400 to-pink-500'
                              )}
                            >
                              {isGuest ? (
                                <div
                                  className="flex items-center justify-center h-12 w-12 rounded-full bg-white/70 shadow-sm"
                                  aria-label="Guest"
                                >
                                  <User className="h-7 w-7 text-gray-700" />
                                </div>
                              ) : (
                                user?.name ? user.name[0].toUpperCase() : <User className="h-9 w-9 text-white" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          {/* No badge for guests to avoid question-mark icon; clear user silhouette already indicates guest */}
                        </div>
                        <div>
                          <h2
                            style={user?.isPro
                              ? {
                                background:
                                  'linear-gradient(90deg, rgb(255, 77, 149), rgb(83, 97, 255), rgb(198, 70, 235), rgb(255, 77, 149))',
                                backgroundSize: '300% 300%',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                animation: 'gradient 15s ease infinite',
                                filter: 'brightness(1.2) contrast(1.3)',
                                textShadow: '0 0 40px rgba(255,255,255,0.1)'
                              }
                              : { color: '#111827' }}
                            className="text-2xl font-semibold"
                          >
                            {isGuest ? t('profile.profilePage.guestName') : user?.name}
                          </h2>
                          {isGuest ? (
                            <p className="text-sm text-gray-500 mt-0.5">{t('profile.profilePage.guestCta')}</p>
                          ) : (
                            joinDate && (
                              <p className="text-sm text-gray-500 mt-0.5">{t('profile.profilePage.memberSince', { date: joinDate })}</p>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Theme Section */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-sm">🌓</span>
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-gray-900">{t('common.theme')}</p>
                            <p className="text-sm text-gray-500">{themeMode === 'dark' ? t('common.dark') : t('common.light')}</p>
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={themeMode === 'dark'}
                            onChange={(e) => {
                              const next: ThemeMode = e.target.checked ? 'dark' : 'light';
                              setThemeMode(next);
                              try {
                                setTheme(next);
                              } catch { }
                            }}
                            aria-label={t('common.theme')}
                          />
                          <span
                            className={cn(
                              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                              themeMode === 'dark' ? 'bg-gray-900' : 'bg-gray-300'
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                                themeMode === 'dark' ? 'translate-x-5' : 'translate-x-0'
                              )}
                            />
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                            beta
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Menu Sections */}
                    {filteredMenuItems.map((section, index) => (
                      <div key={index} className="space-y-2.5">
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">{section.section}</h3>
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 divide-y divide-gray-100">
                          {section.items.map((item: any, itemIndex: number) => (
                            <button
                              key={itemIndex}
                              onClick={item.onClick}
                              className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center',
                                  item.isPro ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-100'
                                )}>
                                  <item.icon className={cn('w-4.5 h-4.5', item.isPro ? 'text-white' : 'text-gray-500')} />
                                </div>
                                <div className="text-start">
                                  <span className="text-[15px] font-medium text-gray-900">{item.label}</span>
                                  <p className="text-xs text-gray-500 mt-0.5">{item.sublabel}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Logout Button */}
                    {!isGuest && (
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowLogoutConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-50/50 active:bg-red-100/50 transition-all duration-200 rounded-full bg-white/80 backdrop-blur-xl border border-white/20 shadow-sm"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm font-medium">{t('common.logout')}</span>
                        </button>
                        <p className="text-xs text-gray-400 text-center">{t('common.version', { version: '1.5' })}</p>
                      </div>
                    )}

                    {/* Bottom Spacing */}
                    <div className="h-12" />
                  </>
                )}

                {currentView === 'settings' && (
                  initialView === 'support' ? (
                    <SupportView />
                  ) : (
                    <SettingsPanel
                      isOpen={true}
                      onClose={() => {
                        setIsSettingsOpen(false);
                        setInitialView('profile');
                      }}
                      initialView={initialView as any}
                    />
                  )
                )}

                {currentView === 'healthgoals' && <HealthGoalsView />}
                {currentView === 'moodtracker' && <MoodTrackerView />}
                {currentView === 'analytics' && <AnalyticsView />}
                {currentView === 'subscription' && <SubscriptionView />}
                {currentView === 'measurements' && <MeasurementsView />}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
      {/* Logout Confirmation Modal (outside main page transition) */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-[90%] max-w-[320px] mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">{t('profile.profilePage.logout.title')}</h3>
                  <p className="text-sm text-gray-600">{t('profile.profilePage.logout.message')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => {
                      auth.signOut();
                      toast.success(t('profile.profilePage.logout.success'));
                      setShowLogoutConfirm(false);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    {t('common.logout')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Pro Subscription Panel */}
      <ProSubscriptionPanel
        isOpen={isProSubscriptionPanelOpen}
        onClose={() => setIsProSubscriptionPanelOpen(false)}
      />
    </div>
  );
};

export default Profile;