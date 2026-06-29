import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Keys correspond to i18n paths under auth.rotating.*
const featureKeys = [
  { key: 'auth.rotating.transform', color: 'text-gray-900' },
  { key: 'auth.rotating.snapMeals', color: 'text-blue-700' },
  { key: 'auth.rotating.aiPlans', color: 'text-green-700' },
  { key: 'auth.rotating.smartRecipes', color: 'text-purple-700' },
  { key: 'auth.rotating.trackProgress', color: 'text-cyan-700' },
  { key: 'auth.rotating.burnWithAI', color: 'text-orange-700' },
  { key: 'auth.rotating.foodCoach', color: 'text-pink-700' },
  { key: 'auth.rotating.smartWorkouts', color: 'text-yellow-700' },
  { key: 'auth.rotating.reachFaster', color: 'text-indigo-700' },
  { key: 'auth.rotating.liveHealthier', color: 'text-red-700' }
];

export const useRotatingText = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => {
      setIsVisible(false); // Start fade out

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % featureKeys.length);
        setIsVisible(true); // Start fade in for next text
      }, 1000); // Wait 1 second after fade out before showing next text

    }, 4000); // Total time for each text (3s visible + 1s transition)

    return () => clearInterval(timer);
  }, []);

  return {
    text: t(featureKeys[currentIndex].key),
    color: featureKeys[currentIndex].color,
    isVisible
  };
}; 