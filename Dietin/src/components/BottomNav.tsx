import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ClipboardList, LineChart, Dumbbell, User, Plus, LucideIcon } from 'lucide-react';
import { useUserStore } from "@/stores/userStore";
import { routes } from "@/lib/routes";
import { useState, useEffect, useRef } from "react";
import MealAnalysis from "./MealAnalysis";
import PlusButton from "./PlusButton";
import NavHide from "./NavHide";
import { useTranslation } from 'react-i18next';

interface BottomNavProps extends React.HTMLAttributes<HTMLDivElement> {
  activePath?: string;
}

interface NavItemType {
  name: string;
  icon: LucideIcon;
  path: string;
  onClick?: () => void;
  requiresAuth?: boolean;
}

export function BottomNav({ className, activePath, ...props }: BottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [lastTrackerPath, setLastTrackerPath] = useState("/diet");
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [isPlusButtonOpen, setIsPlusButtonOpen] = useState(false);
  const [isMealAnalysisOpen, setIsMealAnalysisOpen] = useState(false);
  const [isCustomPlanOpen, setIsCustomPlanOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (["/diet", "/burn", "/hydration"].includes(location.pathname)) {
      setLastTrackerPath(location.pathname);
      localStorage.setItem("lastTrackerPath", location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    const savedTrackerPath = localStorage.getItem("lastTrackerPath");
    if (savedTrackerPath) {
      setLastTrackerPath(savedTrackerPath);
    }
  }, []);

  // Prevent page scroll when interacting with the fixed bottom nav
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const preventScroll = (e: Event) => {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
    };
    const lockBody = () => {
      try { document.body.classList.add('no-scroll'); } catch {}
    };
    const unlockBody = () => {
      try { document.body.classList.remove('no-scroll'); } catch {}
    };
    el.addEventListener('touchmove', preventScroll, { passive: false });
    el.addEventListener('wheel', preventScroll, { passive: false });
    // Some browsers emit gesture events
    el.addEventListener('gesturestart', preventScroll as EventListener, { passive: false } as any);
    // Toggle body scroll lock during interaction
    el.addEventListener('touchstart', lockBody, { passive: true });
    el.addEventListener('touchend', unlockBody, { passive: true });
    el.addEventListener('touchcancel', unlockBody, { passive: true });
    return () => {
      el.removeEventListener('touchmove', preventScroll as EventListener);
      el.removeEventListener('wheel', preventScroll as EventListener);
      el.removeEventListener('gesturestart', preventScroll as EventListener);
      el.removeEventListener('touchstart', lockBody as EventListener);
      el.removeEventListener('touchend', unlockBody as EventListener);
      el.removeEventListener('touchcancel', unlockBody as EventListener);
    };
  }, []);

  // All navigation items
  const allNavItems: NavItemType[] = [
    { name: "home", icon: Home, path: "/home" },
    { name: "workouts", icon: Dumbbell, path: "/plan" },
    { 
      name: "add", 
      icon: Plus, 
      path: "#", 
      onClick: () => setIsPlusButtonOpen(true)
    },
    { name: "tracker", icon: LineChart, path: lastTrackerPath },
    { 
      name: "profile", 
      icon: User, 
      path: "/profile",
      requiresAuth: true 
    }
  ];

  return (
    <>
      <nav 
        className={cn(
          // Make the nav float slightly above the bottom and let the inner container render the glass effect
          "bottom-nav fixed bottom-0 left-0 right-0 z-[2147483647] bg-transparent overflow-visible overscroll-none pointer-events-auto [touch-action:manipulation] relative",
          className
        )} 
        {...props}
        style={{ direction: 'ltr', bottom: 'calc(env(safe-area-inset-bottom) + 0px)' }}
        ref={navRef as any}
        data-bottom-nav="true"
      >
        {/* Removed safe-area cover to avoid any horizontal bar behind the nav */}
        {/* Glassmorphism floating container */}
        <div className="w-[92%] max-w-md mx-auto overflow-hidden overscroll-none rounded-3xl border border-white/40 dark:border-neutral-700/50 bg-white/40 dark:bg-neutral-800/50 backdrop-blur-lg backdrop-saturate-150 shadow-lg shadow-black/10 dark:shadow-gray-900/40 ring-1 ring-white/20 dark:ring-neutral-700/40 supports-[backdrop-filter]:bg-white/35 mb-2">
          <div className="flex items-center justify-between px-6 h-[3.875rem] max-h-[3.875rem]" style={{ direction: 'ltr' }}>
            {allNavItems.map(({ icon: Icon, name, path, onClick, requiresAuth }) => (
              <NavItem 
                key={name}
                Icon={Icon}
                name={name}
                path={path}
                onClick={onClick}
                currentPath={activePath || location.pathname}
                t={t}
                requiresAuth={requiresAuth}
                isAuthenticated={!!user}
              />
            ))}
          </div>
        </div>
      </nav>

      <NavHide isAIOpen={isPlusButtonOpen || isMealAnalysisOpen} />

      <PlusButton 
        isOpen={isPlusButtonOpen}
        onClose={() => setIsPlusButtonOpen(false)}
        setIsMealAnalysisOpen={setIsMealAnalysisOpen}
        setIsCustomPlanOpen={setIsCustomPlanOpen}
      />

      <MealAnalysis 
        isOpen={isMealAnalysisOpen} 
        onClose={() => setIsMealAnalysisOpen(false)}
        setIsSearchOpen={(open: boolean) => {
          if (open) {
            // If we're not on the Diet page, set a flag and navigate there
            if (location.pathname !== '/diet') {
              // Close MealAnalysis before navigating so it doesn't cover Diet
              setIsMealAnalysisOpen(false);
              localStorage.setItem('shouldOpenSearch', 'true');
              navigate('/diet');
            }
          }
        }}
      />
    </>
  );
}

const NavItem = ({ 
  Icon, 
  name, 
  path,
  onClick,
  currentPath,
  t,
  requiresAuth,
  isAuthenticated
}: { 
  Icon: LucideIcon; 
  name: string; 
  path: string;
  onClick?: () => void;
  currentPath: string;
  t: any;
  requiresAuth?: boolean;
  isAuthenticated: boolean;
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = name === "tracker" 
    ? ["/diet", "/burn", "/hydration"].includes(currentPath)
    : name === "workouts"
      ? ["/plan", "/workouts", "/progress"].includes(currentPath)
      : name === "home"
        ? (currentPath === "/" || currentPath === "/home")
        : currentPath === path;

  const isAddButton = name === "add";

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn("nav-item flex flex-col items-center justify-center gap-1.5", isAddButton && "is-add")}
        style={{ direction: 'ltr' }}
      >
        <div className={cn(
          "flex items-center justify-center",
          isAddButton && "add-btn bg-black dark:bg-white rounded-full p-2.5"
        )}>
          <Icon className={cn(
            isAddButton ? "h-[23px] w-[23px]" : "h-[25px] w-[25px]",
            isAddButton ? "text-white dark:text-black" : isActive ? "text-black" : "text-gray-400"
          )} />
        </div>
        {!isAddButton && (
          <span className={cn(
            "text-[10px] font-medium",
            isActive ? "text-black" : "text-gray-400"
          )}>
            {t(`nav.${name}`)}
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      to={path}
      className={cn("nav-item flex flex-col items-center justify-center gap-1.5", isAddButton && "is-add")}
      style={{ direction: 'ltr' }}
    >
      <div className={cn(
        "flex items-center justify-center",
        isAddButton && "add-btn bg-black dark:bg-white rounded-full p-2.5"
      )}>
        <Icon className={cn(
          isAddButton ? "h-[23px] w-[23px]" : "h-[25px] w-[25px]",
          isAddButton ? "text-white dark:text-black" : isActive ? "text-black" : "text-gray-400"
        )} />
      </div>
      {!isAddButton && (
        <span className={cn(
          "text-[10px] font-medium",
          isActive ? "text-black" : "text-gray-400"
        )}>
          {t(`nav.${name}`)}
        </span>
      )}
    </Link>
  );
};
