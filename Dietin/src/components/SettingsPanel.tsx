import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { X, ChevronRight, User, Bell, Palette, Globe, LifeBuoy, ChevronLeft, Camera, Pencil, Trash2, Heart, LogOut, Smile, Lock, Loader2, Check, Sparkles, Clock, FileText, Fingerprint, Smartphone, AlertTriangle, Copy, Mail } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
 
 
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, getDoc, onSnapshot, deleteDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { signOut, sendPasswordResetEmail, updateEmail, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { toast } from "sonner";
import NavHide from './NavHide';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { UserProfile, ActivityLevel, ExperienceLevel, WorkoutDays, Gender, DietType, Goal } from '@/lib/types';
import { analyzeUserProfile } from "@/lib/gemini";
import { LanguageSwitcher } from './LanguageSwitcher';
import { ProSubscriptionPanel } from './ProSubscriptionPanel';
import { useTranslation } from 'react-i18next';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'main' | 'profile' | 'security' | 'features' | 'language' | 'notifications';
}

const SPRING_CONFIG = {
  type: "spring",
  damping: 25,
  stiffness: 200,
};

const settingsItems = [
  {
    section: 'account',
    items: [
      { title: 'profileInfo', icon: User },
      { title: 'security', icon: Lock },
      { title: 'language', icon: Globe },
    ]
  },
  {
    section: 'features',
    items: [
      { title: 'moodTracker', icon: Smile },
    ]
  },
  {
    section: 'support',
    items: [
      { title: 'privacyPolicy', icon: Lock },
      { title: 'termsOfService', icon: FileText },
    ]
  }
] as const;

export const SettingsPanel = ({ isOpen, onClose, initialView = 'main' }: SettingsPanelProps) => {
  const { user, updateUser, updateProfilePicture, resetUser } = useUserStore();
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState<'main' | 'profile' | 'security' | 'features' | 'language' | 'notifications'>(initialView);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.name || '');
  const [isNameValid, setIsNameValid] = useState(false);
  const [isProPanelOpen, setIsProPanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [showPasswordVerification, setShowPasswordVerification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (password: string) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [firestoreUser, setFirestoreUser] = useState<any>(null);
  const [useMetric, setUseMetric] = useState(true);
  const [heightFt, setHeightFt] = useState(0);
  const [heightIn, setHeightIn] = useState(0);
  const [tempFormData, setTempFormData] = useState({
    age: user?.age || 0,
    gender: user?.gender || 'MALE',
    height: user?.height || 0,
    weight: user?.weight || 0,
    experienceLevel: user?.experienceLevel || 'BEGINNER',
    activityLevel: user?.activityLevel || 'LIGHTLY_ACTIVE',
    workoutDays: user?.workoutDays || 2,
    goal: user?.goal || 'LOSE_WEIGHT',
    targetWeight: user?.targetWeight || 0,
    weeklyGoal: user?.weeklyGoal || 0.5,
    diet: user?.diet || 'CLASSIC'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdateDate, setLastUpdateDate] = useState<string | null>(null);
  const [updatesRemaining, setUpdatesRemaining] = useState(2);
  const [canUpdate, setCanUpdate] = useState(true);
  const [isMoodTrackerEnabled, setIsMoodTrackerEnabled] = useState(user?.isMoodTrackerEnabled ?? true);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const isRTL = (i18n as any)?.dir ? (i18n as any).dir(i18n.language) === 'rtl' : (typeof document !== 'undefined' ? document.dir === 'rtl' : false);

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const toggleAllNotifications = () => {
    setNotificationsEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setPushEnabled(false);
        setEmailEnabled(false);
      }
      return next;
    });
  };

  // Data & Privacy actions
  const handleRequestAccountData = async () => {
    try {
      const userAuth = auth.currentUser;
      if (!userAuth) {
        toast.error(t('settingsPanel.errors.noAuthenticatedUser'));
        return;
      }
      const uid = userAuth.uid;
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      const exportData: any = {
        profile: userSnap.exists() ? userSnap.data() : {},
      };
      // Attempt to include some common subcollections if they exist
      const possibleSubs = ['measurements', 'workouts', 'meals', 'notes'];
      for (const sub of possibleSubs) {
        try {
          const colRef = collection(db, 'users', uid, sub);
          const colSnap = await getDocs(colRef);
          if (!colSnap.empty) {
            exportData[sub] = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
        } catch {}
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dietin-account-data-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settingsPanel.messages.accountDataExported'));
    } catch (err) {
      console.error(err);
      toast.error(t('settingsPanel.errors.failedToExportData'));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const userAuth = auth.currentUser;
      if (!userAuth) {
        toast.error(t('settingsPanel.errors.noAuthenticatedUser'));
        return;
      }
      const confirmDelete = window.confirm(t('settingsPanel.deleteAccount.confirm'));
      if (!confirmDelete) return;

      const uid = userAuth.uid;
      // Delete primary user doc
      try { await deleteDoc(doc(db, 'users', uid)); } catch {}
      // Attempt to purge some common subcollections
      const possibleSubs = ['measurements', 'workouts', 'meals', 'notes'];
      for (const sub of possibleSubs) {
        try {
          const colRef = collection(db, 'users', uid, sub);
          const colSnap = await getDocs(colRef);
          const deletions = colSnap.docs.map(d => deleteDoc(doc(db, 'users', uid, sub, d.id)));
          await Promise.all(deletions);
        } catch {}
      }

      // Delete auth user
      await deleteUser(userAuth);

      toast.success(t('settingsPanel.messages.accountDeleted'));
      resetUser();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/requires-recent-login') {
        toast.error(t('settingsPanel.errors.reauthToDelete'));
      } else {
        toast.error(t('settingsPanel.errors.failedToDeleteAccount'));
      }
    }
  };

  // Update currentView when initialView changes
  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  // Add conversion helpers
  const convertToMetric = (ft: number, inches: number) => {
    const totalInches = (ft * 12) + (inches || 0);
    return Math.round(totalInches * 2.54);
  };

  const convertToImperial = (cm: number) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  };

  const convertWeight = (weight: number, toMetric: boolean) => {
    return toMetric ? 
      Math.round(weight * 0.453592) : 
      Math.round(weight / 0.453592);
  };

  // Add validation helpers
  const isHeightValid = () => {
    if (useMetric) {
      return !!tempFormData.height && tempFormData.height >= 120 && tempFormData.height <= 220;
    } else {
      return heightFt >= 4 && heightFt <= 7 && heightIn >= 0 && heightIn <= 11;
    }
  };

  const isWeightValid = () => {
    if (!tempFormData.weight) return false;
    return useMetric ? 
      tempFormData.weight >= 30 && tempFormData.weight <= 180 :
      tempFormData.weight >= 66 && tempFormData.weight <= 400;
  };

  const handleClose = () => {
    onClose();
    // Reset state immediately
    setCurrentView('main');
    setIsEditingName(false);
    setTempName(user?.name || '');
    setIsNameValid(false);
  };

  // Reset all state when panel is closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('main');
      setIsEditingName(false);
      setTempName(user?.name || '');
      setIsNameValid(false);
    }
  }, [isOpen, user?.name]);

  // Add real-time listener for user data
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setFirestoreUser(data);
        setLastUpdateDate(data.lastUpdateDate);
        setUpdatesRemaining(data.updatesRemaining || 2);
        setCanUpdate(data.canUpdate !== undefined ? data.canUpdate : true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize mood tracker state from user settings
  useEffect(() => {
    if (user) {
      setIsMoodTrackerEnabled(user.isMoodTrackerEnabled ?? true);
    }
  }, [user]);

  const handleNameSave = async () => {
    if (!tempName.trim()) {
      toast.error(t('settingsPanel.errors.enterName'));
      return;
    }
    
    try {
      if (!auth.currentUser?.uid) {
        toast.error(t('settingsPanel.errors.userNotAuthenticated'));
        return;
      }

      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        name: tempName.trim(),
        lastUpdated: new Date().toISOString()
      });

      updateUser({ name: tempName.trim() });
      setIsEditingName(false);
      toast.success(t('settingsPanel.messages.nameUpdated'));
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error(t('settingsPanel.errors.failedToUpdateName'));
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          // Update local state
          updateProfilePicture(base64String);
          
          // Update Firebase
          if (auth.currentUser) {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
              profilePicture: base64String,
              lastUpdated: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error updating profile picture:', error);
          toast.error(t('settingsPanel.errors.failedToUpdateProfilePicture'));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      // Update local state
      updateUser({ profilePicture: null });
      
      // Update Firebase
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          profilePicture: null,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast.error(t('settingsPanel.errors.failedToRemoveProfilePicture'));
    }
  };

  const handlePasswordReset = async () => {
    try {
      if (!auth.currentUser?.email) {
        toast.error(t('settingsPanel.errors.noEmailForAccount'));
        return;
      }
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      toast.success(t('settingsPanel.messages.passwordResetSent'));
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error(t('settingsPanel.errors.failedToSendPasswordReset'));
    }
  };

  const handleItemClick = (title: string) => {
    // title is an i18n key identifier (e.g., 'profileInfo', 'language')
    switch (title) {
      case 'profileInfo':
        setCurrentView('profile');
        break;
      case 'privacyPolicy':
        navigate('/privacy-policy');
        break;
      case 'termsOfService':
        navigate('/terms-of-service');
        break;
      case 'moodTracker':
        setCurrentView('features');
        break;
      case 'security':
        setCurrentView('security');
        break;
      case 'language':
        setCurrentView('language');
        break;
      case 'notifications':
        setCurrentView('notifications');
        break;
      default:
        break;
    }
  };

  const updateTempForm = (changes: Partial<typeof tempFormData>) => {
    setTempFormData(prev => ({ ...prev, ...changes }));
    setHasChanges(true);
  };

  const canUpdateProfile = () => {
    if (!lastUpdateDate) return true;

    const lastUpdate = new Date(lastUpdateDate);
    const now = new Date();
    
    // Get the start of the current week (Sunday)
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    
    // Get the start of the last update's week
    const lastUpdateWeekStart = new Date(lastUpdate);
    lastUpdateWeekStart.setHours(0, 0, 0, 0);
    lastUpdateWeekStart.setDate(lastUpdate.getDate() - lastUpdate.getDay());
    
    // If we're in a new week, reset updates
    if (currentWeekStart > lastUpdateWeekStart) {
      return true;
    }

    // Otherwise, check if we have updates remaining
    return updatesRemaining > 0;
  };

  const handleSaveChanges = async () => {
    if (!canUpdateProfile()) {
      toast.error(t('settingsPanel.messages.weeklyUpdateLimit'));
      return;
    }

    setIsLoading(true);
    try {
      if (!auth.currentUser?.uid) {
        throw new Error(t('settingsPanel.errors.userNotAuthenticated'));
      }

      const userRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      // Calculate updates remaining
      const now = new Date();
      const lastUpdate = lastUpdateDate ? new Date(lastUpdateDate) : null;
      const currentWeekStart = new Date(now);
      currentWeekStart.setHours(0, 0, 0, 0);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      
      const lastUpdateWeekStart = lastUpdate ? new Date(lastUpdate) : null;
      if (lastUpdateWeekStart) {
        lastUpdateWeekStart.setHours(0, 0, 0, 0);
        lastUpdateWeekStart.setDate(lastUpdate.getDate() - lastUpdate.getDay());
      }
      
      const updatesLeft = currentWeekStart > (lastUpdateWeekStart || new Date(0)) 
        ? 1 // Reset to 1 remaining (since we're using one now)
        : Math.max(0, (updatesRemaining || 2) - 1);

      const updates = {
        ...tempFormData,
        name: tempName.trim(),
        lastUpdated: now.toISOString(),
        lastUpdateDate: now.toISOString(),
        updatesRemaining: updatesLeft,
        canUpdate: updatesLeft > 0
      };

      await updateDoc(userRef, updates);
      updateUser({ ...tempFormData, name: tempName.trim() });
      setHasChanges(false);
      setIsEditingName(false);
      onClose();
      toast.success(t('settingsPanel.messages.changesSaved'));
    } catch (error: any) {
      console.error('Error saving changes:', error);
      toast.error(error.message || t('settingsPanel.errors.failedToSaveChanges'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoodTrackerToggle = () => {
    const newValue = !isMoodTrackerEnabled;
    setIsMoodTrackerEnabled(newValue);
    updateUser({ isMoodTrackerEnabled: newValue });
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    } else {
      y.set(0);
    }
    setIsDragging(false);
  };

  return (
    <div className={cn(
      "min-h-full",
      currentView === 'profile' && "personal-info-section"
    )}>
      <div className="h-full overflow-y-auto pb-safe -webkit-overflow-scrolling-touch">
        <div className="relative h-full">
          <AnimatePresence mode="wait">
            {currentView === 'main' ? (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto scrollbar-hide touch-pan-y"
              >
                <div className="p-0 space-y-6">
                  {settingsItems.map((section, sectionIndex) => (
                    <motion.div
                      key={section.section}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ 
                        delay: 0.2 + (sectionIndex * 0.05),
                        duration: 0.2,
                        ease: "easeOut"
                      }}
                      className="space-y-2"
                    >
                      <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wider px-6 mb-1">
                        {section.section}
                      </h3>
                      <div className="space-y-0.5">
                        {section.items.map((item, itemIndex) => (
                          <motion.button
                            key={item.title}
                            onClick={() => handleItemClick(item.title)}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{
                              delay: 0.25 + (sectionIndex * 0.05) + (itemIndex * 0.05),
                              duration: 0.2,
                              ease: "easeOut"
                            }}
                            className="w-full px-6 py-2.5 flex items-center justify-between rounded-lg hover:bg-gray-100 transition-all duration-300 group hover:scale-[0.99]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 group-hover:from-primary/20 group-hover:to-secondary/20 transition-colors">
                                {item.icon && <item.icon className="w-4 h-4 text-primary group-hover:text-secondary transition-colors" />}
                              </div>
                              <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">{item.title}</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 transition-colors group-hover:translate-x-0.5" />
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  {/* Version info */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="pt-4 px-6 border-t border-gray-100 space-y-4"
                  >
                    {/* Version text */}
                    <p className="text-xs text-gray-500 text-center">
                      {t('common.version', { version: '1.5' })}
                    </p>

                    {/* Sign Out Button */}
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      onClick={async () => {
                        try {
                          await signOut(auth);
                          resetUser();
                          handleClose();
                          navigate('/home');
                        } catch (error) {
                          console.error('Error signing out:', error);
                          toast.error(t('auth.signOutFailed', { defaultValue: "We couldn't sign you out. Please try again." }));
                        }
                      }}
                      className="w-full p-2.5 flex items-center justify-center gap-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-300 group text-red-400 hover:text-red-300"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">Sign Out</span>
                    </motion.button>
                  </motion.div>
                </div>
              </motion.div>
            ) : currentView === 'profile' ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto scrollbar-hide touch-pan-y h-full relative pb-safe"
              >
                <div className="space-y-6 pb-[120px]">
                  <div className="flex justify-between items-center pt-2">
                    <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('settingsPanel.personal.title')}</h1>
                  </div>
                  {/* Back Button */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => onClose()}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('common.back')}</span>
                  </motion.button>

                  {/* Profile Content */}
                  <div className="space-y-8">
                    {/* Profile Header */}
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative group">
                        <Avatar className="w-24 h-24 border-2 border-white shadow-xl ring-4 ring-gray-100 transition-all duration-300 group-hover:ring-primary/20">
                          <AvatarImage src={user?.profilePicture} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-secondary/80 text-white text-2xl">
                            {user?.name ? user.name[0].toUpperCase() : <User className="w-8 h-8" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 right-0 flex gap-1.5 scale-100 opacity-100 transition-all duration-300">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors"
                            aria-label="Upload profile picture"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          {user?.profilePicture && (
                            <button
                              onClick={handleRemoveProfilePicture}
                              className="p-2 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
                              aria-label="Remove profile picture"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </div>

                      {/* Name Edit */}
                      <div className="w-full max-w-xs">
                        {isEditingName ? (
                          <div className="flex gap-2">
                            <Input
                              value={tempName}
                              onChange={(e) => {
                                setTempName(e.target.value);
                                setHasChanges(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setTempName(user?.name || '');
                                  setIsEditingName(false);
                                }
                              }}
                              className="h-10 bg-gray-50/50 border-gray-100 focus:border-primary text-center text-lg font-medium text-gray-900 rounded-xl"
                              placeholder="Enter your name"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <h3 className="text-xl font-semibold text-gray-900 text-center">
                              {user?.name || "Set up your profile"}
                            </h3>
                            <button
                              onClick={() => {
                                setTempName(user?.name || '');
                                setIsEditingName(true);
                              }}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-white/95 backdrop-blur-xl border border-gray-100 shadow-sm rounded-xl p-6 space-y-8">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">{t('settingsPanel.personal.sectionTitle')}</h4>
                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl shadow-sm">
                          <span className={cn("text-sm font-medium transition-colors duration-200", !useMetric ? "text-gray-900" : "text-gray-500")}>{t('settingsPanel.personal.imperial')}</span>
                          <button 
                            onClick={() => {
                              setUseMetric(prev => {
                                const newMetric = !prev;
                                if (tempFormData.weight) {
                                  const newWeight = convertWeight(tempFormData.weight, newMetric);
                                  updateTempForm({ weight: newWeight });
                                }
                                if (prev && tempFormData.height) {
                                  const { feet, inches } = convertToImperial(tempFormData.height);
                                  setHeightFt(feet);
                                  setHeightIn(inches);
                                } else if (!prev && heightFt) {
                                  const cm = convertToMetric(heightFt, heightIn || 0);
                                  updateTempForm({ height: cm });
                                }
                                return newMetric;
                              });
                            }}
                            className="w-14 h-7 bg-white rounded-full relative transition-colors duration-300 shadow-sm border border-gray-200"
                          >
                            <div 
                              className={cn(
                                "absolute top-1 w-5 h-5 rounded-full transition-all duration-300 shadow-sm",
                                useMetric ? "right-1 bg-primary" : "left-1 bg-gray-400"
                              )}
                            />
                          </button>
                          <span className={cn("text-sm font-medium transition-colors duration-200", useMetric ? "text-gray-900" : "text-gray-500")}>{t('settingsPanel.personal.metric')}</span>
                        </div>
                      </div>

                      <div className="grid gap-8">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-6">
                          {/* Age */}
                          <motion.div 
                            className="col-span-1 relative group"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.age.label')}</label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={tempFormData.age || ''}
                                  onChange={(e) => updateTempForm({ age: parseInt(e.target.value) })}
                                  className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 placeholder:text-gray-400 rounded-xl pr-12 group-hover:border-primary"
                                  placeholder={t('settingsPanel.personal.age.placeholder')}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-primary transition-colors duration-200">
                                  <Clock className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                          </motion.div>

                          {/* Gender */}
                          <motion.div 
                            className="col-span-1 relative group"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                          >
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.gender.label')}</label>
                              <Select
                                value={tempFormData.gender || ''}
                                onValueChange={(value) => updateTempForm({ gender: value as Gender })}
                              >
                                <SelectTrigger className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl group-hover:border-primary">
                                  <SelectValue placeholder={t('settingsPanel.personal.gender.placeholder')} />
                                </SelectTrigger>
                                <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
                                  <SelectItem value="MALE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">{t('settingsPanel.personal.gender.male')}</SelectItem>
                                  <SelectItem value="FEMALE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">{t('settingsPanel.personal.gender.female')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        </div>

                        {/* Body Metrics */}
                        <div className="grid grid-cols-2 gap-6">
                          {/* Height */}
                          <motion.div 
                            className="col-span-1 relative group"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                          >
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.height.label')} {useMetric ? '(cm)' : '(ft/in)'}</label>
                              {useMetric ? (
                                <div className="relative">
                                  <Input
                                    type="number"
                                    value={tempFormData.height || ''}
                                    onChange={(e) => updateTempForm({ height: parseInt(e.target.value) })}
                                    className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl pr-12 group-hover:border-primary"
                                    placeholder={t('settingsPanel.personal.height.placeholder')}
                                    min={120}
                                    max={220}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                                </div>
                              ) : (
                                <div className="flex gap-3">
                                  <div className="relative flex-1">
                                    <Input
                                      type="number"
                                      value={heightFt || ''}
                                      onChange={(e) => {
                                        const ft = parseInt(e.target.value);
                                        setHeightFt(ft);
                                        const cm = convertToMetric(ft, heightIn);
                                        updateTempForm({ height: cm });
                                      }}
                                      className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl pr-12 group-hover:border-primary"
                                      placeholder="ft"
                                      min={4}
                                      max={7}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">ft</span>
                                  </div>
                                  <div className="relative flex-1">
                                    <Input
                                      type="number"
                                      value={heightIn || ''}
                                      onChange={(e) => {
                                        const inches = parseInt(e.target.value);
                                        setHeightIn(inches);
                                        const cm = convertToMetric(heightFt, inches);
                                        updateTempForm({ height: cm });
                                      }}
                                      className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl pr-12 group-hover:border-primary"
                                      placeholder="in"
                                      min={0}
                                      max={11}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">in</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>

                          {/* Weight */}
                          <motion.div 
                            className="col-span-1 relative group"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.3 }}
                          >
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.weight.label')} {useMetric ? '(kg)' : '(lbs)'}</label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={tempFormData.weight || ''}
                                  onChange={(e) => updateTempForm({ weight: parseInt(e.target.value) })}
                                  className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl pr-12 group-hover:border-primary"
                                  placeholder={t('settingsPanel.personal.weight.placeholder')}
                                  min={useMetric ? 30 : 66}
                                  max={useMetric ? 180 : 400}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{useMetric ? 'kg' : 'lbs'}</span>
                              </div>
                            </div>
                          </motion.div>
                        </div>

                        {/* Fitness Level */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.4 }}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.fitnessLevel.label')}</label>
                            <Select
                              value={tempFormData.experienceLevel || ''}
                              onValueChange={(value) => updateTempForm({ experienceLevel: value as ExperienceLevel })}
                            >
                              <SelectTrigger className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl group-hover:border-primary">
                                <SelectValue placeholder={t('settingsPanel.personal.fitnessLevel.placeholder')} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
                                <SelectItem value="BEGINNER" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    {t('settingsPanel.personal.fitnessLevel.options.beginner')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="INTERMEDIATE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    {t('settingsPanel.personal.fitnessLevel.options.intermediate')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="ADVANCED" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    {t('settingsPanel.personal.fitnessLevel.options.advanced')}
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>

                        {/* Activity Level */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.5 }}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.activityLevel.label')}</label>
                            <Select
                              value={tempFormData.activityLevel || ''}
                              onValueChange={(value) => updateTempForm({ activityLevel: value as ActivityLevel })}
                            >
                              <SelectTrigger className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl group-hover:border-primary">
                                <SelectValue placeholder={t('settingsPanel.personal.activityLevel.placeholder')} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
                                <SelectItem value="LIGHTLY_ACTIVE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                    {t('settingsPanel.personal.activityLevel.options.lightlyActive')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="MODERATELY_ACTIVE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    {t('settingsPanel.personal.activityLevel.options.moderatelyActive')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="VERY_ACTIVE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                                    {t('settingsPanel.personal.activityLevel.options.veryActive')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="EXTRA_ACTIVE" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-700" />
                                    {t('settingsPanel.personal.activityLevel.options.extraActive')}
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>

                        {/* Workout Days */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.6 }}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.workoutDays.label')}</label>
                            <Select
                              value={tempFormData.workoutDays?.toString() || ''}
                              onValueChange={(value) => updateTempForm({ workoutDays: parseInt(value) as WorkoutDays })}
                            >
                              <SelectTrigger className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl group-hover:border-primary">
                                <SelectValue placeholder={t('settingsPanel.personal.workoutDays.placeholder')} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
                                {[2, 3, 4, 5, 6].map((days) => (
                                  <SelectItem key={days} value={days.toString()} className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-primary" style={{ opacity: days / 6 }} />
                                      {days} {t('common.days')}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>

                        {/* Goal */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.7 }}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.fitnessGoal.label')}</label>
                            <Select
                              value={tempFormData.goal || ''}
                              onValueChange={(value) => updateTempForm({ goal: value as Goal })}
                            >
                              <SelectTrigger className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl group-hover:border-primary">
                                <SelectValue placeholder={t('settingsPanel.personal.fitnessGoal.placeholder')} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
                                <SelectItem value="LOSE_WEIGHT" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    {t('settingsPanel.personal.fitnessGoal.options.loseWeight')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="MAINTAIN_WEIGHT" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    {t('settingsPanel.personal.fitnessGoal.options.maintainWeight')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="GAIN_WEIGHT" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    {t('settingsPanel.personal.fitnessGoal.options.gainWeight')}
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>

                        {/* Target Weight */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.8 }}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.targetWeight.label')} {useMetric ? '(kg)' : '(lbs)'}</label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={tempFormData.targetWeight || ''}
                                onChange={(e) => updateTempForm({ targetWeight: parseFloat(e.target.value) })}
                                className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl pr-12 group-hover:border-primary"
                                placeholder={t('settingsPanel.personal.targetWeight.placeholder')}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{useMetric ? 'kg' : 'lbs'}</span>
                            </div>
                          </div>
                        </motion.div>

                        {/* Weekly Goal */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.9 }}
                        >
                          <div className="space-y-4">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.weeklyProgress.label')} {useMetric ? '(kg)' : '(lbs)'}</label>
                            <div className="space-y-6">
                              <div className="relative pt-1">
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1.0}
                                  step={0.1}
                                  value={tempFormData.weeklyGoal || 0.5}
                                  onChange={(e) => updateTempForm({ weeklyGoal: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-primary"
                                  style={{
                                    background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${((tempFormData.weeklyGoal || 0.5) - 0.1) * 100 / 0.9}%, #f3f4f6 ${((tempFormData.weeklyGoal || 0.5) - 0.1) * 100 / 0.9}%, #f3f4f6 100%)`
                                  }}
                                />
                                <div className="flex justify-between mt-2">
                                  <div className="flex flex-col items-center">
                                    <div className="w-1 h-3 bg-gray-300 rounded-full mb-1" />
                                    <span className="text-xs text-gray-500">0.1</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="w-1 h-2 bg-gray-300 rounded-full mb-1" />
                                    <span className="text-xs text-gray-500">0.3</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="w-1 h-3 bg-gray-300 rounded-full mb-1" />
                                    <span className="text-xs text-gray-500">0.5</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="w-1 h-2 bg-gray-300 rounded-full mb-1" />
                                    <span className="text-xs text-gray-500">0.7</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <div className="w-1 h-3 bg-gray-300 rounded-full mb-1" />
                                    <span className="text-xs text-gray-500">1.0</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">{t('settingsPanel.personal.weeklyProgress.slider.steady')}</span>
                                <span className="text-gray-500">{t('settingsPanel.personal.weeklyProgress.slider.balanced')}</span>
                                <span className="text-xs text-gray-500">{t('settingsPanel.personal.weeklyProgress.slider.ambitious')}</span>
                              </div>
                              <div className="text-center">
                                <span className="text-sm font-medium text-gray-900 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                                  {tempFormData.weeklyGoal} {useMetric ? 'kg' : 'lbs'} {t('settingsPanel.personal.weeklyProgress.perWeek')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        {/* Diet Type */}
                        <motion.div 
                          className="relative group"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 1.0 }}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t('settingsPanel.personal.dietType.label')}</label>
                            <Select
                              value={tempFormData.diet || ''}
                              onValueChange={(value) => updateTempForm({ diet: value as DietType })}
                            >
                              <SelectTrigger className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-xl group-hover:border-primary">
                                <SelectValue placeholder={t('settingsPanel.personal.dietType.placeholder')} />
                              </SelectTrigger>
                              <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
                                <SelectItem value="CLASSIC" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                                    {t('settingsPanel.personal.dietType.options.classic')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="PESCATARIAN" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    {t('settingsPanel.personal.dietType.options.pescatarian')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="VEGETARIAN" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    {t('settingsPanel.personal.dietType.options.vegetarian')}
                                  </div>
                                </SelectItem>
                                <SelectItem value="VEGAN" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    {t('settingsPanel.personal.dietType.options.vegan')}
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>

                        {/* Save Changes Button */}
                        <motion.div 
                          className="bg-white/95 backdrop-blur-xl border border-gray-100 shadow-lg rounded-xl p-6"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.8 }}
                        >
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={handleSaveChanges}
                              disabled={!hasChanges || isLoading}
                              className="w-full bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
                            >
                              {isLoading ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {t('settingsPanel.personal.actions.saving')}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Check className="w-4 h-4" />
                                  {t('settingsPanel.personal.actions.saveChanges')}
                                </div>
                              )}
                            </Button>
                            <p className="text-[10px] text-gray-500 text-center">{t('settingsPanel.personal.actions.note')}</p>
                            {!canUpdate && (
                              <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                                <Sparkles className="w-3 h-3" />
                                <span>{t('settingsPanel.messages.weeklyUpdateLimit')}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : currentView === 'security' ? (
              <motion.div
                key="security"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto scrollbar-hide touch-pan-y"
              >
                <div className="space-y-6 pb-24">
                  <div className="flex justify-between items-center pt-2">
                    <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('settingsPanel.security.title')}</h1>
                  </div>
                  {/* Back Button */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => onClose()}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm">{t('common.back')}</span>
                  </motion.button>

                  {/* Security Content */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{t('settingsPanel.security.sectionTitle')}</h4>
                    </div>

                    {/* Account Security Section */}
                    <div className="space-y-3">
                      {/* Pro Status Card */}
                      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="relative p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-md bg-gray-100 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.security.proStatus.title')}</h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">{firestoreUser?.isPro ? t('settingsPanel.security.proStatus.proMember') : t('settingsPanel.security.proStatus.freeMember')}</span>
                                {firestoreUser?.proExpiryDate && (
                                  <span className="text-xs text-gray-400">
                                    • {t('settingsPanel.security.proStatus.expires', { date: new Date(firestoreUser.proExpiryDate).toLocaleDateString() })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User ID Card */}
                      <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.security.userId.title')}</h3>
                              <p className="text-xs text-gray-500 font-mono">{
                                (() => {
                                  const uid = auth.currentUser?.uid;
                                  if (!uid) return '-';
                                  const half = Math.floor(uid.length / 2);
                                  return uid.slice(0, half) + '*'.repeat(uid.length - half);
                                })()
                              }</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const uid = auth.currentUser?.uid;
                              if (uid) {
                                const half = Math.floor(uid.length / 2);
                                navigator.clipboard.writeText(uid.slice(0, half));
                                toast.success(t('settingsPanel.security.userId.copied'));
                              }
                            }}
                            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <p className="text-xs text-amber-600">{t('settingsPanel.security.userId.shareWarning')}</p>
                        </div>
                      </div>

                      {/* Email Display (Read Only) */}
                      <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Mail className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.security.email.title')}</h3>
                              <p className="text-xs text-gray-500">{auth.currentUser?.email}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Password Security Card */}
                      <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.security.password.title')}</h3>
                              <p className="text-xs text-gray-500">{t('settingsPanel.security.password.lastChanged', { days: 30 })}</p>
                            </div>
                          </div>
                          <button
                            onClick={handlePasswordReset}
                            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 text-xs font-medium hover:bg-gray-200 transition-colors"
                          >
                            {t('settingsPanel.security.password.reset')}
                          </button>
                        </div>
                      </div>

                      {/* Data & Privacy */}
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-200">
                        <button onClick={handleRequestAccountData} className="w-full text-left p-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.security.dataPrivacy.requestData.title')}</h3>
                            <p className="text-xs text-gray-500">{t('settingsPanel.security.dataPrivacy.requestData.desc')}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={handleDeleteAccount} className="w-full text-left p-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-red-600">{t('settingsPanel.security.dataPrivacy.delete.title')}</h3>
                            <p className="text-xs text-gray-500">{t('settingsPanel.security.dataPrivacy.delete.desc')}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : currentView === 'features' ? (
              <motion.div
                key="features"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto scrollbar-hide touch-pan-y"
              >
                <div className="px-5 pt-4 space-y-6 pb-24">
                  <div className="flex justify-between items-center pt-2">
                    <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">Features</h1>
                  </div>
                  {/* Back Button */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => onClose()}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900 mb-6"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm">Back</span>
                  </motion.button>

                  {/* Features Content */}
                  <div className="space-y-6">
                    <h4 className="text-sm font-medium text-gray-800 px-1">Features Settings</h4>

                    <div className="space-y-4">
                      {/* Mood Tracker Toggle */}
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-100 border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Smile className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex flex-col items-start">
                            <h3 className="text-sm font-medium text-gray-800 leading-none mb-1">Mood Tracker</h3>
                            <span className="text-xs text-gray-600 leading-none">Daily mood tracking popup</span>
                          </div>
                        </div>
                        <button
                          onClick={handleMoodTrackerToggle}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-all duration-300",
                            isMoodTrackerEnabled ? "bg-primary/20" : "bg-gray-100"
                          )}
                        >
                          <motion.div 
                            layout
                            initial={false}
                            animate={{ 
                              x: isMoodTrackerEnabled ? 24 : 0,
                            }}
                            className={cn(
                              "absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm",
                              isMoodTrackerEnabled ? "bg-primary" : "bg-gray-400"
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
                  </div>
                </div>
              </motion.div>
            ) : currentView === 'notifications' ? (
              <motion.div
                key="notifications"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto scrollbar-hide touch-pan-y"
              >
                <div className="space-y-6 pb-24">
                  <div className="flex justify-between items-center pt-2">
                    <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('settingsPanel.notifications.title')}</h1>
                  </div>
                  {/* Back Button */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => onClose()}
                    className={cn(
                      "px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900",
                      isRTL ? 'flex-row-reverse' : ''
                    )}
                  >
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    <span className="text-sm">{t('common.back')}</span>
                  </motion.button>

                  {/* Notifications Content */}
                  <div className="space-y-6">
                    <div className="bg-white/95 backdrop-blur-xl border border-gray-100 rounded-xl shadow-sm divide-y divide-gray-100">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-gray-500" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.notifications.enableAll.title')}</h3>
                            <p className="text-xs text-gray-500">{t('settingsPanel.notifications.enableAll.desc')}</p>
                          </div>
                        </div>
                        <button
                          onClick={toggleAllNotifications}
                          aria-pressed={notificationsEnabled}
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 ${notificationsEnabled ? 'bg-primary/20' : 'bg-gray-100'}`}
                        >
                          <motion.div
                            layout
                            initial={false}
                            animate={{ x: notificationsEnabled ? 24 : 0 }}
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm ${notificationsEnabled ? 'bg-primary' : 'bg-gray-400'}`}
                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.notifications.push.title')}</h3>
                          <p className="text-xs text-gray-500">{t('settingsPanel.notifications.push.desc')}</p>
                        </div>
                        <button
                          onClick={() => notificationsEnabled && setPushEnabled((v) => !v)}
                          aria-pressed={pushEnabled}
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 ${pushEnabled ? 'bg-primary/20' : 'bg-gray-100'} ${!notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <motion.div
                            layout
                            initial={false}
                            animate={{ x: pushEnabled ? 24 : 0 }}
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm ${pushEnabled ? 'bg-primary' : 'bg-gray-400'}`}
                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{t('settingsPanel.notifications.email.title')}</h3>
                          <p className="text-xs text-gray-500">{t('settingsPanel.notifications.email.desc')}</p>
                        </div>
                        <button
                          onClick={() => notificationsEnabled && setEmailEnabled((v) => !v)}
                          aria-pressed={emailEnabled}
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 ${emailEnabled ? 'bg-primary/20' : 'bg-gray-100'} ${!notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <motion.div
                            layout
                            initial={false}
                            animate={{ x: emailEnabled ? 24 : 0 }}
                            className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm ${emailEnabled ? 'bg-primary' : 'bg-gray-400'}`}
                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : currentView === 'language' ? (
              <motion.div
                key="language"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-y-auto scrollbar-hide touch-pan-y"
              >
                <div className="space-y-6 pb-24">
                  {/* Header */}
                  <div className="flex justify-between items-center pt-2">
                    <h1 className="text-[1.75rem] font-bold text-gray-900 tracking-[-0.01em]">{t('settingsPanel.language.title')}</h1>
                  </div>
                  {/* Back Button */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => onClose()}
                    className={cn(
                      "px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900 mb-6",
                      isRTL ? 'flex-row-reverse' : ''
                    )}
                  >
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    <span className="text-sm">{t('common.back')}</span>
                  </motion.button>

                  {/* Language Content */}
                  <div className="space-y-6">
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-100 border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <h3 className="text-sm font-medium text-gray-800 leading-tight truncate whitespace-nowrap">{t('settingsPanel.language.appLanguage')}</h3>
                          </div>
                        </div>
                        <div className="shrink-0 scale-95">
                          <LanguageSwitcher />
                        </div>
                      </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {showPasswordVerification.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100001] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-100 rounded-xl p-6 w-full max-w-md relative border border-gray-200 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{showPasswordVerification.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{showPasswordVerification.message}</p>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
              await showPasswordVerification.onConfirm(password);
              setShowPasswordVerification(prev => ({ ...prev, isOpen: false }));
            }}>
              <input
                type="password"
                name="password"
                autoFocus
                className="w-full h-10 px-3 rounded-lg bg-gray-50 border border-gray-100 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors mb-4"
                placeholder={t('settingsPanel.password.enter')}
              />
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordVerification(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-800 font-medium transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-gray-900 font-medium transition-colors"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ProSubscriptionPanel 
        isOpen={isProPanelOpen}
        onClose={() => setIsProPanelOpen(false)}
      />
    </div>
  );
};

export default SettingsPanel;
