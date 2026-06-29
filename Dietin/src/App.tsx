import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import Index from "./pages/Index";
import Workouts from "./pages/Workouts";
import Diet from "./pages/Diet";
import Profile from "./pages/Profile";
import Burn from "./pages/Burn";
import Hydration from "./pages/Hydration";
import { BottomNav } from "@/components/BottomNav";
import { Welcome } from "@/components/Welcome";
import { Auth } from "@/components/Auth";
import { useUserStore } from "@/stores/userStore";
import { useProgressStore } from "@/stores/progressStore";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from 'framer-motion';
import NavHide from "@/components/NavHide";
import { auth, db, dbPromise, tryReconnect, syncPendingWrites } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";
import Plan from '@/pages/Plan';
import Progress from './pages/Progress';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import Deactivated from './pages/Deactivated';
import Payment from './pages/Payment';
import PaymentReturn from './pages/PaymentReturn';
import { onAuthStateChanged } from 'firebase/auth';
import { seedUserDocBaseline } from '@/stores/userStore';
import MoodTracker from '@/components/MoodTracker';
import { Landing } from './pages/Landing';
import { LoginButton } from '@/components/LoginButton';
import { RefreshCw } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where, writeBatch } from 'firebase/firestore';
import BackgroundWithGlow from '@/components/BackgroundWithGlow';
import TopStatusBackground from '@/components/TopStatusBackground';
import InstallPWAButton from '@/components/InstallPWAButton';

const queryClient = new QueryClient();

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser, loadMealDataFromFirestore, checkAndResetYearlyMeals } = useUserStore();
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [isAIOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [lastProtectedPath, setLastProtectedPath] = useState<string | null>(null);
  // Temporarily disable the AddToHomeScreen gate in dev and when explicitly turned off
  const gateEnabled = (() => {
    const envFlag = (import.meta as any).env?.VITE_ENABLE_A2HS_GATE;
    // Treat localhost and common private LAN ranges as dev
    const isDevHost = (
      /localhost|127\.0\.0\.1|192\.168\./.test(window.location.hostname) ||
      /^10\./.test(window.location.hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname) ||
      window.location.hostname.endsWith('ngrok-free.app')
    );
    if (envFlag === 'false') return false;
    if (isDevHost) return false;
    return true;
  })();

  // Enforce browser vs PWA behavior: in browser mode, only allow verify/reset pages
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  const isBrowserMode = !isStandalone;
  const browserAllowedPaths = ['/verify-email', '/reset-password'];
  const onLanding = location.pathname === '/landing' || location.pathname === '/';
  // Show gate if in browser mode and not on allowed bypass pages.
  // Always force gate on landing page (first access) even if gateEnabled is false (e.g., dev host),
  // so QA can validate and users are prompted properly.
  const shouldShowGate = isBrowserMode && !browserAllowedPaths.includes(location.pathname) && (gateEnabled || onLanding);
  // keep variable referenced to avoid unused var lints after removing the gate component
  void shouldShowGate;

  // Network status monitoring effect
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back online',
        description: 'Connection restored. Your data will now sync automatically.',
        variant: 'default'
      });
      
      // Attempt to reconnect to Firestore when back online
      tryReconnect().then((success) => {
        if (success && auth.currentUser) {
            loadMealDataFromFirestore();
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You are offline',
        description: 'Changes will be saved locally and synced when you reconnect.',
        variant: 'destructive'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadMealDataFromFirestore]);

  // Protected routes check
  const protectedPaths = ['/burn', '/hydration', '/workouts', '/progress'];
  const authOnlyPaths = ['/auth'];

  // Update lastProtectedPath if on a protected route without auth
  useEffect(() => {
    if (!user && protectedPaths.includes(location.pathname)) {
      setLastProtectedPath(location.pathname);
    }
  }, [user, location.pathname, protectedPaths]);

  // Bottom nav visibility effect
  useEffect(() => {
    const isLandingOrAuth = ['/auth', '/welcome', '/landing', '/verify-email', '/reset-password'].includes(location.pathname);
    setShowBottomNav(!isLandingOrAuth);
    
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Landing page check effect
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem('hasSeenLanding');
    const currentPath = location.pathname;
    // Exempt verification/reset pages from first-visit landing redirect
    const exemptPaths = ['/verify-email', '/reset-password'];
    if (exemptPaths.includes(currentPath)) {
      return;
    }

    if (!hasSeenLanding && currentPath !== '/landing') {
      navigate('/landing', { replace: true });
    } else if (hasSeenLanding && (currentPath === '/landing' || currentPath === '/')) {
      if (user) {
        if (user.onboardingCompleted) {
          navigate('/home', { replace: true });
        } else {
          navigate('/welcome', { replace: true });
        }
      } else {
        // No app user yet (e.g., Firebase user may be unverified) -> go to home (default page)
        navigate('/home', { replace: true });
      }
    }
  }, [location.pathname, navigate, user]);

  // Firebase connection effect (one-time fetch instead of live listener to reduce reads)
  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const handleFirestoreConnection = async (firebaseUser: any) => {
      if (!firebaseUser) {
        console.log('No Firebase user, clearing user data');
        setUser(null);
        try { useProgressStore.getState().reset(); } catch {}
        return;
      }
      // Block unverified users ONLY for email/password provider
      const providerIds = (firebaseUser.providerData || []).map(p => p?.providerId);
      const isPasswordProvider = providerIds.includes('password');
      if (isPasswordProvider && !firebaseUser.emailVerified) {
        console.log('Unverified email/password user. Skipping user state and navigation.');
        setUser(null);
        return;
      }

      try {
        console.log('Firebase User:', firebaseUser);
        console.log('Firestore database connection established');
        setFirestoreError(null);

        const userRef = doc(db, "users", firebaseUser.uid);
        const docSnapshot = await getDoc(userRef);
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const userWithDefaults = {
            name: userData.name || firebaseUser.displayName || '',
            username: userData.username || firebaseUser.email?.split('@')[0] || 'user',
            height: userData.height ?? null,
            weight: userData.weight ?? null,
            bmi: userData.bmi ?? undefined,
            bmiCategory: userData.bmiCategory ?? undefined,
            calorieGoal: userData.calorieGoal || 2000,
            proteinGoal: userData.proteinGoal || 150,
            carbsGoal: userData.carbsGoal || 200,
            fatGoal: userData.fatGoal || 70,
            metabolism: userData.metabolism || 2200,
            experienceLevel: userData.experienceLevel || 'BEGINNER',
            onboardingCompleted: userData.onboardingCompleted || false,
            profilePicture: userData.profilePicture || firebaseUser.photoURL || null,
            isPro: userData.isPro || false,
            proExpiryDate: userData.proExpiryDate || null,
            isMoodTrackerEnabled: userData.isMoodTrackerEnabled ?? true,
            moodHistory: userData.moodHistory || []
          };
          // Seed baseline for conservative writes
          seedUserDocBaseline(firebaseUser.uid, userData);
          setUser(userWithDefaults);
          retryCount = 0;
          setFirestoreError(null);
          loadMealDataFromFirestore();
          checkAndResetYearlyMeals();
          // Fire-and-forget hydrate of the Progress 2.0 cache.
          try { void useProgressStore.getState().hydrate(firebaseUser.uid); } catch {}

          if (userData.isPro && userData.proExpiryDate) {
            const expiryDate = new Date(userData.proExpiryDate);
            const now = new Date();
            if (now > expiryDate) {
              await updateDoc(userRef, {
                isPro: false,
                proExpiryDate: null,
                lastUpdated: new Date().toISOString()
              });
              toast({
                title: 'Your Pro subscription has expired',
                description: 'Please resubscribe to continue enjoying Pro features.',
                variant: 'destructive'
              });
            }
          }
        } else {
          try {
            const newUser = {
              name: firebaseUser.displayName || '',
              username: firebaseUser.email?.split('@')[0] || 'user',
              height: null,
              weight: null,
              calorieGoal: 2000,
              proteinGoal: 150,
              carbsGoal: 200,
              fatGoal: 70,
              metabolism: 2200,
              experienceLevel: 'BEGINNER' as const,
              onboardingCompleted: false,
              profilePicture: firebaseUser.photoURL || null,
              isPro: false,
              proExpiryDate: null,
              isMoodTrackerEnabled: true,
              moodHistory: []
            };
            await setDoc(userRef, {
              ...newUser,
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            });
            // Seed baseline with what we just wrote
            seedUserDocBaseline(firebaseUser.uid, newUser as any);
            setUser(newUser);
            retryCount = 0;
            setFirestoreError(null);
            loadMealDataFromFirestore();
            checkAndResetYearlyMeals();
            try { void useProgressStore.getState().hydrate(firebaseUser.uid); } catch {}
          } catch (creationError) {
            console.error('Error creating new user document:', creationError);
            setFirestoreError('Failed to create user document');
          }
        }
      } catch (error: any) {
        console.error('Error during Firestore user handling:', error);
        setFirestoreError(error.message || 'Firestore error');
      }
    };

    const handleConnectionError = () => {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying connection (${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
        
        setTimeout(() => {
          tryReconnect().then((success) => {
            if (success) {
              const currentUser = auth.currentUser;
              if (currentUser) {
                handleFirestoreConnection(currentUser);
              }
            } else {
              console.log('Reconnect attempt failed');
            }
          });
        }, delay);
      } else {
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to database after multiple attempts. Please check your internet connection and try manual reconnection.',
          variant: 'destructive'
        });
      }
    };

    const getFirebaseErrorMessage = (errorCode: string): string => {
      switch(errorCode) {
        case 'unavailable':
          return 'Database service is currently unavailable. Please try again later.';
        case 'permission-denied':
          return 'You do not have permission to access this data.';
        case 'unauthenticated':
          return 'You need to be signed in to access this data.';
        case 'deadline-exceeded':
          return 'The operation timed out. Please check your internet connection.';
        case 'cancelled':
          return 'The operation was cancelled.';
        case 'data-loss':
          return 'Unrecoverable data loss or corruption.';
        case 'unknown':
          return 'An unknown error occurred. Please try again.';
        case 'invalid-argument':
          return 'Invalid argument provided to database operation.';
        case 'not-found':
          return 'The requested document was not found.';
        case 'already-exists':
          return 'The document already exists.';
        case 'resource-exhausted':
          return 'Quota exceeded or rate limit reached.';
        default:
          return `Error connecting to database: ${errorCode}`;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      await handleFirestoreConnection(firebaseUser);
    });

    return () => {
      unsubscribe();
    };
  }, [setUser, loadMealDataFromFirestore, checkAndResetYearlyMeals]);

  // Manual reconnection handler
  const handleManualReconnect = async () => {
    setIsReconnecting(true);
    try {
      await syncPendingWrites();
      const reconnected = await tryReconnect();
      
      if (reconnected) {
        setFirestoreError(null);
        toast({
          title: 'Reconnected successfully',
          description: 'Your app is now connected to the database.',
          variant: 'default'
        });
        
        loadMealDataFromFirestore();
      } else {
        toast({
          title: 'Reconnection failed',
          description: 'Could not reconnect to the database. Please check your internet connection and try again.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Manual reconnection error:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  // Offline Indicator component
  const OfflineIndicator = () => {
    if (isOnline && !firestoreError) return null;
    
    return (
      <div className="fixed bottom-20 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`${!isOnline ? 'bg-destructive text-destructive-foreground' : 'bg-amber-600 text-white'} 
                    px-4 py-2 rounded-full shadow-lg 
                    flex items-center gap-2 pointer-events-auto cursor-pointer`}
          onClick={handleManualReconnect}
        >
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-sm font-medium">
            {!isOnline ? 'You are offline' : firestoreError}
          </span>
          {(isReconnecting || firestoreError) && (
            <RefreshCw size={16} className={`ml-1 ${isReconnecting ? 'animate-spin' : ''}`} />
          )}
        </motion.div>
      </div>
    );
  };

  // Early return checks for protected routes and auth
  // Global browser-mode gate: block pages when not installed as PWA
  // Gate removed

  if (!user && protectedPaths.includes(location.pathname)) {
    return <Navigate to="/login-prompt" replace />;
  }

  if (user && authOnlyPaths.includes(location.pathname)) {
    return <Navigate to={lastProtectedPath || '/home'} replace />;
  }

  if (user && !user.onboardingCompleted && location.pathname !== '/welcome' && !location.pathname.startsWith('/auth')) {
    return <Navigate to="/welcome" replace />;
  }

  if (user?.onboardingCompleted && location.pathname === '/welcome') {
    return <Navigate to="/home" replace />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen w-full relative">
          {/* Blocker overlay removed: A2HS gate disabled */}
          {/* Background layers removed to let global BackgroundWithGlow be visible */}
          
          {/* Scrollable Content */}
          <main className={cn(
            "relative z-10 min-h-screen w-full isolate",
            showBottomNav && "pb-20",
            location.pathname === '/landing' && "z-50"
          )}>
            <div className="h-full">
              <AnimatePresence mode="wait">
                {/* Show login button for non-logged in users except on auth and landing pages */}
                {!user && !location.pathname.includes('auth') && !location.pathname.includes('landing') && (
                  <LoginButton />
                )}
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={
                    localStorage.getItem('hasSeenLanding') ? 
                      <Navigate to="/home" /> : 
                      <Navigate to="/landing" />
                  } />
                  <Route path="/landing" element={
                    localStorage.getItem('hasSeenLanding') ? 
                      <Navigate to="/home" /> :
                      <AnimatedPage>
                        <Landing />
                      </AnimatedPage>
                  } />
                  {/* Redirect legacy/missing login prompt route to the Auth page to prevent blank screens */}
                  <Route path="/login-prompt" element={<Navigate to="/auth" replace />} />
                  {mounted && !location.pathname.includes('landing') && (
                    <>
                      <Route path="/home" element={
                        <AnimatedPage>
                          <Index />
                        </AnimatedPage>
                      } />
                      <Route path="/workouts" element={
                        <AnimatedPage>
                          <Workouts />
                        </AnimatedPage>
                      } />
                      <Route path="/diet" element={
                        <AnimatedPage>
                          <Diet />
                        </AnimatedPage>
                      } />
                      <Route path="/profile" element={
                        <AnimatedPage>
                          <Profile />
                        </AnimatedPage>
                      } />
                      <Route path="/auth" element={
                        user ? <Navigate to="/home" /> :
                        <AnimatedPage>
                          <Auth />
                        </AnimatedPage>
                      } />
                      <Route path="/welcome" element={
                        <AnimatedPage>
                          <Welcome />
                        </AnimatedPage>
                      } />
                      <Route path="/burn" element={
                        <AnimatedPage>
                          <Burn />
                        </AnimatedPage>
                      } />
                      <Route path="/hydration" element={
                        <AnimatedPage>
                          <Hydration />
                        </AnimatedPage>
                      } />
                      <Route path="/plan" element={
                        <AnimatedPage>
                          <Plan />
                        </AnimatedPage>
                      } />
                      <Route path="/progress" element={
                        <AnimatedPage>
                          <Progress />
                        </AnimatedPage>
                      } />
                      <Route path="/reset-password" element={
                        <AnimatedPage>
                          <ResetPassword />
                        </AnimatedPage>
                      } />
                      <Route path="/verify-email" element={
                        <AnimatedPage>
                          <VerifyEmail />
                        </AnimatedPage>
                      } />
                      <Route path="/payment" element={
                        <AnimatedPage>
                          <Payment />
                        </AnimatedPage>
                      } />
                      <Route path="/payment/return" element={
                        <AnimatedPage>
                          <PaymentReturn />
                        </AnimatedPage>
                      } />
                      {/* Catch-all fallback to avoid unmatched-route blank screens */}
                      <Route path="*" element={<Navigate to="/home" replace />} />
                    </>
                  )}
                </Routes>
              </AnimatePresence>
            </div>
          </main>

          {/* Floating Install button for Android/Chromium when prompt is available. Hidden when gate is shown. */}
          {!shouldShowGate && <InstallPWAButton />}

          {/* Bottom Navigation */}
          {showBottomNav && mounted && !location.pathname.includes('landing') && (
            <>
              <NavHide isAIOpen={isAIOpen} />
              <BottomNav 
                className="fixed bottom-0 left-0 right-0 pb-safe-area-inset-bottom" 
                activePath={lastProtectedPath || location.pathname}
              />
              <MoodTracker />
            </>
          )}
        </div>
      </TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TopStatusBackground />
        <BackgroundWithGlow />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}