import { useUserStore } from '@/stores/userStore';
import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useTranslation } from 'react-i18next';

const BMIIndicator = () => {
  const { user, updateUser } = useUserStore();
  const { t } = useTranslation();
  
  const calculateBMI = (weight: number, height: number) => {
    // Convert height from cm to meters
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Healthy';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const getIndicatorPosition = (bmi: number) => {
    // Calculate position percentage based on BMI
    // BMI range typically from 15 to 35 = range of 20 units
    const position = ((bmi - 15) / 20) * 100;
    // Clamp between 0 and 100
    return Math.min(Math.max(position, 0), 100);
  };

  // Calculate and update BMI whenever weight or height changes
  useEffect(() => {
    const updateBMI = async () => {
      if (user?.weight && user?.height) {
        const bmi = Number(calculateBMI(user.weight, user.height));
        const category = getBMICategory(bmi);
        
        // Update BMI in Firestore
        const currentUser = auth.currentUser;
        if (currentUser?.uid) {
          try {
            await updateDoc(doc(db, "users", currentUser.uid), {
              bmi,
              bmiCategory: category,
              lastUpdated: new Date().toISOString()
            });

            // Update local state
            updateUser({
              bmi,
              bmiCategory: category
            });
          } catch (error) {
            console.error("Error updating BMI:", error);
          }
        }
      }
    };

    updateBMI();
  }, [user?.weight, user?.height]);

  const bmi = user?.weight && user?.height ? 
    calculateBMI(user.weight, user.height) : '0.0';
  const category = getBMICategory(Number(bmi));
  const position = getIndicatorPosition(Number(bmi));

  const translateCategory = (cat: string) => {
    switch (cat) {
      case 'Underweight':
        return t('profile.bmi.underweight');
      case 'Healthy':
        return t('profile.bmi.healthy');
      case 'Overweight':
        return t('profile.bmi.overweight');
      case 'Obese':
        return t('profile.bmi.obese');
      default:
        return cat;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">{t('profile.bmi.title')}</p>
            <p className="text-[1.75rem] font-semibold tracking-tight text-gray-900">{bmi}</p>
            <p className="text-sm font-medium text-gray-600">{translateCategory(category)}</p>
          </div>
        </div>

        {/* Force LTR for the scale so low BMI is on the left and high on the right regardless of app language */}
        <div className="relative" dir="ltr">
          {/* BMI Bar Background */}
          <div className="h-1.5 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-400" />
          
          {/* Indicator */}
          <div 
            className="absolute top-0 -mt-[4px] w-3.5 h-3.5 bg-white rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3)] transform -translate-x-1/2 transition-all duration-300"
            style={{ left: `${position}%` }}
          />

          {/* Categories (kept LTR order to match scale) */}
          <div className="flex justify-between mt-3">
            <span className="text-[0.7rem] font-medium text-blue-400">{t('profile.bmi.underweight')}</span>
            <span className="text-[0.7rem] font-medium text-green-400">{t('profile.bmi.healthy')}</span>
            <span className="text-[0.7rem] font-medium text-yellow-400">{t('profile.bmi.overweight')}</span>
            <span className="text-[0.7rem] font-medium text-red-400">{t('profile.bmi.obese')}</span>
          </div>

          {/* BMI Scale */}
          <div className="flex justify-between mt-2">
            <span className="text-[0.65rem] text-gray-400">15</span>
            <span className="text-[0.65rem] text-gray-400">20</span>
            <span className="text-[0.65rem] text-gray-400">25</span>
            <span className="text-[0.65rem] text-gray-400">30</span>
            <span className="text-[0.65rem] text-gray-400">35</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BMIIndicator; 