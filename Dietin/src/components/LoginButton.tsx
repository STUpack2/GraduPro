import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const LoginButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('ar');
  const path = (location.pathname || '').toLowerCase();
  const hide = path.includes('verify-email') || path.includes('reset-password');

  if (hide) return null;

  return (
    <motion.button
      onClick={() => navigate('/auth')}
      className={`login-btn fixed ${isArabic ? 'left-4' : 'right-4'} z-50 bg-black text-white rounded-full p-2 shadow-lg hover:bg-black/90 transition-colors duration-200 top-[calc(env(safe-area-inset-top)_+_24px)]`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: -40, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
          duration: 0.6,
          ease: [0.23, 1, 0.32, 1],
          scale: {
            type: "spring",
            damping: 8,
            stiffness: 100,
            restDelta: 0.001
          }
        }
      }}
    >
      <motion.div
        initial={{ rotate: -180, scale: 0 }}
        animate={{ 
          rotate: 0, 
          scale: 1,
          transition: {
            type: "spring",
            damping: 10,
            stiffness: 100,
            delay: 0.2
          }
        }}
      >
        <User className="w-6 h-6 text-white" />
      </motion.div>
    </motion.button>
  );
}; 