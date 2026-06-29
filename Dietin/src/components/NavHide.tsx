import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface NavHideProps {
  isAIOpen?: boolean;
  isWorkoutStarted?: boolean;
  showExerciseModal?: boolean;
}

const NavHide: React.FC<NavHideProps> = ({ isAIOpen, isWorkoutStarted, showExerciseModal }) => {
  const location = useLocation();

  useEffect(() => {
    // Select via data attribute added to BottomNav
    const nav = document.querySelector('[data-bottom-nav="true"]') as HTMLElement;
    if (!nav) return;

    const updateNavVisibility = (forceHide?: boolean) => {
      if (forceHide || 
          isWorkoutStarted || 
          showExerciseModal || 
          // Hide nav whenever the Plus/AI sheet is open, regardless of route
          isAIOpen ||
          document.querySelector('.settings-panel') !== null ||
          document.querySelector('.personal-info-section') !== null // Hide nav whenever personal info section is visible
      ) {
        // Fade out quickly and disable interactions
        nav.style.transition = 'opacity 0.175s ease';
        nav.style.opacity = '0';
        nav.style.pointerEvents = 'none';
      } else {
        // Fade in smoothly and enable interactions
        nav.style.transition = 'opacity 0.175s ease';
        nav.style.opacity = '1';
        nav.style.pointerEvents = 'auto';
      }
    };

    // Listen for custom setNavHide event
    const handleSetNavHide = (event: CustomEvent<{ isHidden: boolean }>) => {
      updateNavVisibility(event.detail.isHidden);
    };

    document.addEventListener('setNavHide', handleSetNavHide as EventListener);
    updateNavVisibility();

    // Cleanup function to ensure nav is visible when component unmounts
    return () => {
      document.removeEventListener('setNavHide', handleSetNavHide as EventListener);
      nav.style.opacity = '1';
      nav.style.pointerEvents = 'auto';
    };
  }, [isAIOpen, isWorkoutStarted, showExerciseModal, location.pathname]);

  return null;
};

export default NavHide;
