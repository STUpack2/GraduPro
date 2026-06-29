import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Check, Rocket, Star, Zap, Brain, Camera, ChartBar, Lock, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useUserStore } from "@/stores/userStore";
import NavHide from './NavHide';
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { useTranslation } from 'react-i18next';

// Exact same spring config as AIAssistant
const SPRING_CONFIG = {
  type: "spring",
  damping: 25,
  stiffness: 200
};

interface ProSubscriptionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// plans will be built from i18n inside the component

export const ProSubscriptionPanel = ({ isOpen, onClose }: ProSubscriptionPanelProps) => {
  const { updateUser } = useUserStore();
  const { t } = useTranslation();
  const [showRedeemPopup, setShowRedeemPopup] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [localIsOpen, setLocalIsOpen] = useState(isOpen);
  
  // Paymob standalone product link (safe to expose). Do NOT expose secret/server keys in frontend.
  const PAYMOB_PRODUCT_URL =
    'https://accept.paymobsolutions.com/standalone?ref=p_LRR2allDMFNEbmFXc2hyMS9DTkJqRDRiUT09X2VuaW5iUDRPOWJpSHhPR1VaNkg3OWc9PQ';

  const handlePaymobPayment = () => {
    try {
      window.open(PAYMOB_PRODUCT_URL, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to open Paymob link', e);
      toast({
        title: t('proPanel.paymob.errorOpenTitle', { defaultValue: 'Payment Error' }),
        description: t('proPanel.paymob.errorOpenDesc', { defaultValue: 'Could not open Paymob checkout. Please try again.' }),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    setLocalIsOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });

    // Add event listener for opening panel
    const handleOpenPanel = () => {
      setIsLoading(true);
      setLocalIsOpen(true);
    };

    window.addEventListener('openProSubscriptionPanel', handleOpenPanel);

    return () => {
      unsubscribe();
      window.removeEventListener('openProSubscriptionPanel', handleOpenPanel);
    };
  }, []);


  const handleRedeemCode = async () => {
    setIsRedeeming(true);
    try {
      toast({
        title: t('proPanel.redeem.comingSoonTitle'),
        description: t('proPanel.redeem.comingSoonDesc'),
        variant: 'default'
      });
      
      setRedeemCode('');
      setShowRedeemPopup(false);
    } catch (error) {
      toast({
        title: t('proPanel.redeem.notAvailableTitle'),
        description: t('proPanel.redeem.notAvailableDesc'),
        variant: 'destructive'
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    createPortal(
      <AnimatePresence>
        {localIsOpen && (
          <>
            <NavHide isAIOpen={localIsOpen} />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              onClick={onClose}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 40,
                stiffness: 300,
                mass: 0.8
              }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0}
              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
              dragMomentum={false}
              onDrag={(e, { offset }) => {
                if (offset.y < 0) {
                  (e.target as HTMLElement).style.transform = `translateY(0px)`;
                }
              }}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 50 || velocity.y > 50) {
                  onClose();
                } else {
                  (e.target as HTMLElement).style.transform = `translateY(0px)`;
                }
              }}
              style={{ touchAction: 'none' }}
              className="fixed bottom-0 left-0 right-0 z-[99999] touch-none select-none overscroll-none"
            >
              <div className="bg-white rounded-t-[20px] overflow-hidden shadow-2xl mx-auto max-w-[420px] h-[85vh] relative flex flex-col">
              <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex flex-col px-6 pb-4 flex-shrink-0 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">
                      {t('proPanel.title')}
                    </h2>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                  {isLoggedIn 
                    ? t('proPanel.header.loggedIn')
                    : t('proPanel.header.loggedOut')}
                </p>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {!isLoggedIn ? (
                  // Non-logged in user view
                  <div className="p-6 space-y-6">
                    <div className="space-y-6">
                      {([
                        {
                          name: t('proPanel.plans.pro.name'),
                          features: t('proPanel.plans.pro.features', { returnObjects: true }) as string[],
                          icon: Rocket,
                          highlight: true,
                        }
                      ]).filter(p => (p as any).highlight).map((plan: any, index) => {
                        const Icon = plan.icon;
                        return (
                          <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + index * 0.1 }}
                            className={`relative overflow-hidden rounded-2xl border bg-gray-50 border-gray-100 p-4`}
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`h-10 w-10 rounded-xl ${
                                    'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-purple-200/40'
                                  } flex items-center justify-center`}>
                                    <Icon className={`w-5 h-5 text-white`} />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                    {/* Price intentionally hidden for a cleaner, nonchalant look */}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {plan.features.map((feature, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + index * 0.1 + i * 0.05 }}
                                    className="flex items-center gap-2.5"
                                  >
                                    <div className={`w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center`}>
                                      <Check className={`w-2.5 h-2.5 text-indigo-600`} />
                                    </div>
                                    <span className="text-[13px] text-gray-600">{feature}</span>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col items-center gap-4">
                      <Link 
                        to="/auth"
                        onClick={onClose}
                        className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity text-center relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-soft-light" />
                        <span className="relative">{t('proPanel.cta.signInOrCreate')}</span>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.5, 0] }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            repeatType: "reverse"
                          }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:opacity-50"
                        />
                      </Link>
                      <p className="text-xs text-gray-500 text-center max-w-[280px]">
                        {t('proPanel.cta.joinNowLine')}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Logged in user view
                  <div className="p-6 space-y-4">
                    {/* Plans Comparison */}
                    <div className="space-y-4">
                      {([
                        {
                          name: t('proPanel.plans.pro.name'),
                          features: t('proPanel.plans.pro.features', { returnObjects: true }) as string[],
                          icon: Rocket,
                          highlight: true,
                        }
                      ]).filter(p => (p as any).highlight).map((plan: any, index) => {
                        const Icon = plan.icon;
                        return (
                          <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                            className={`relative overflow-hidden rounded-2xl border bg-white border-gray-100 shadow-xl p-4`}
                          >
                            <div className="flex flex-col relative">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`h-10 w-10 rounded-xl ${
                                    'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-purple-200/40'
                                  } flex items-center justify-center relative overflow-hidden`}>
                                    <Icon className={`w-5 h-5 text-white relative z-10`} />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                    {/* Price and badges hidden for minimal look */}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {plan.features.map((feature, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + index * 0.1 + i * 0.05 }}
                                    className="flex items-center gap-2.5"
                                  >
                                    <div className={`w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center`}>
                                      <Check className={`w-2.5 h-2.5 text-indigo-600`} />
                                    </div>
                                    <span className="text-[13px] text-gray-900">{feature}</span>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}

                      
                      {/* Paymob Button Wrapper */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="mt-4 space-y-3 bg-white rounded-2xl p-4 border border-gray-200 relative overflow-hidden shadow-xl"
                      >
                        <div className="relative flex flex-col items-center gap-3">
                          <button
                            onClick={handlePaymobPayment}
                            className="w-full px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors text-center"
                          >
                            {t('proPanel.paymob.payWith', { defaultValue: 'Pay with Paymob' })}
                          </button>
                          <div className="text-center space-y-2">
                            <p className="text-sm text-gray-900 font-medium flex items-center justify-center gap-1">
                              <Lock className="w-4 h-4 text-gray-600" /> {t('proPanel.checkout.secureViaPaymob', { defaultValue: 'Secure via Paymob' })}
                            </p>
                            <p className="text-[10px] text-gray-600">
                              {t('proPanel.checkout.agreePrefix')}{" "}
                              <a
                                href="https://dietin.fit/privacy-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-900 hover:text-black transition-colors font-medium"
                                onClick={onClose}
                              >
                                {t('auth.privacyPolicy')}
                              </a>
                              {" "}{t('proPanel.checkout.and')}{" "}
                              <a
                                href="https://dietin.fit/terms-of-service"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-900 hover:text-black transition-colors font-medium"
                                onClick={onClose}
                              >
                                {t('auth.termsOfService')}
                              </a>
                              . {t('proPanel.checkout.oneTimeNoRenewal')}
                            </p>
                            <p className="text-[10px] text-gray-500">{t('proPanel.checkout.instantAccess')} • {t('proPanel.checkout.cancelWithin')}</p>
                          </div>
                        </div>
                      </motion.div>

                      

                      {/* Redeem Code Button */}
                      <div className="flex justify-center mt-2">
                        <button
                          onClick={() => setShowRedeemPopup(true)}
                          className="text-xs text-gray-900 hover:text-black transition-colors font-medium"
                        >
                          {t('proPanel.redeem.haveCode')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Redeem Code Popup (layered above) */}
            {isLoggedIn && (
              <AnimatePresence>
                {showRedeemPopup && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000]"
                      onClick={() => setShowRedeemPopup(false)}
                    />
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 20 }}
                      className="fixed bottom-0 inset-x-0 z-[100001] p-4 bg-white rounded-t-xl border-t border-gray-100"
                    >
                      <div className="max-w-[420px] mx-auto space-y-3">
                        <h3 className="text-base font-semibold text-gray-900">{t('proPanel.redeem.title')}</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={redeemCode}
                            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                            placeholder={t('proPanel.redeem.placeholder')}
                            maxLength={12}
                            className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <button
                            onClick={handleRedeemCode}
                            disabled={isRedeeming}
                            className={cn(
                              "px-4 py-2 bg-blue-500 text-white rounded-lg transition relative overflow-hidden text-sm font-medium hover:bg-blue-600",
                              isRedeeming && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isRedeeming ? (
                              <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                            ) : (
                              t('proPanel.redeem.action')
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </>
        )}
      </AnimatePresence>,
      document.body
    )
  );
};

export default ProSubscriptionPanel;