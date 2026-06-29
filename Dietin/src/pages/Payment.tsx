import { motion, AnimatePresence } from "framer-motion";
import { Check, Rocket, Loader2, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { auth } from "@/lib/firebase";
import { useUserStore } from "@/stores/userStore";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { useTranslation } from 'react-i18next';
import NavHide from '@/components/NavHide';
import paymobLogo from '@/assets/image.png';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';

const Payment = () => {
  const { updateUser } = useUserStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showRedeemPopup, setShowRedeemPopup] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual'); // Default to annual (most popular)

  const [starting, setStarting] = useState(false);

  // Secure start via Cloud Functions (server creates session and returns URL)
  const handlePaymobPayment = async () => {
    if (!auth.currentUser) {
      toast({
        title: t('auth.loginRequiredTitle', { defaultValue: 'Login required' }),
        description: t('auth.loginRequiredDesc', { defaultValue: 'Please sign in to continue with payment.' }),
        variant: 'destructive',
      });
      return;
    }
    setStarting(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const start = httpsCallable(functions, 'subscriptions_start');
      const res: any = await start({ plan: selectedPlan });
      const url = res?.data?.url;
      if (!url) throw new Error('No URL from server');
      window.location.href = url; // use same tab for better return flow
    } catch (e) {
      console.error('Failed to start Paymob session', e);
      toast({
        title: t('proPanel.paymob.errorOpenTitle', { defaultValue: 'Payment Error' }),
        description: t('proPanel.paymob.errorOpenDesc', { defaultValue: 'Could not open Paymob checkout. Please try again.' }),
        variant: 'destructive',
      });
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Page Title (match Home header) */}
        <div className="flex justify-between items-center">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-[1.75rem] tracking-tight font-sf-display font-sf-bold relative flex items-baseline gap-2"
          >
            <span className="text-black">{t('payment.title', { defaultValue: 'Payment' })}</span>
          </motion.h1>
        </div>

        {/* Back Button (Profile style) under title */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 border border-black/10 transition-all duration-200 flex items-center gap-2 group text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">{t('common.back', { defaultValue: 'Back' })}</span>
        </motion.button>

        {!isLoggedIn ? (
          // Non-logged in user view
          <>
            {/* Main Plan Card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 text-white relative overflow-hidden"
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-soft-light" />

              {/* Price Badge */}
              <div className="absolute top-4 right-4 space-y-1 text-right rtl:left-4 rtl:right-auto rtl:text-left">
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 inline-block">
                  <span className="text-sm font-semibold">EGP 350/{t('payment.month', { defaultValue: 'mo' })}</span>
                </div>
                <div className="text-[10px] text-white/80">EGP 3500/{t('payment.year', { defaultValue: 'year' })}</div>
              </div>

              <div className="relative pr-20 rtl:pl-20 rtl:pr-0">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white">
                      {t('proPanel.plans.pro.name', { defaultValue: 'Pro Plan' })}
                    </h2>
                    <p className="text-blue-100 text-sm break-words">
                      {t('payment.subtitle', { defaultValue: 'Unlock unlimited access' })}
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {(t('payment.features', {
                    returnObjects: true,
                    defaultValue: [
                      'unlimited AI meal planning',
                      'Advanced nutrition tracking',
                      'Mood tracker',
                      'Hydration tracker',
                      'AI generated cardio & hydration suggestions',
                      'Progress analytics',
                      'Priority support'
                    ]
                  }) as string[]).map((feature, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-indigo-600" />
                      </div>
                      <span className="text-sm text-white/90">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Billing Options */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {t('payment.billingOptions', { defaultValue: 'Billing Options' })}
              </h3>

              {/* Monthly Option */}
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={cn(
                  "w-full bg-white rounded-2xl border p-4 transition-all duration-200 text-left",
                  selectedPlan === 'monthly'
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        selectedPlan === 'monthly'
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-gray-300"
                      )}>
                        {selectedPlan === 'monthly' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">
                        {t('payment.monthly', { defaultValue: 'Monthly' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 ml-6">
                      {t('payment.monthlyDesc', { defaultValue: 'Billed monthly' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">EGP 350</div>
                    <div className="text-xs text-gray-500">/month</div>
                  </div>
                </div>
              </button>

              {/* Annual Option - Highlighted */}
              <button
                onClick={() => setSelectedPlan('annual')}
                className={cn(
                  "w-full bg-white rounded-2xl border p-4 relative transition-all duration-200 text-left",
                  selectedPlan === 'annual'
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 border-2"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                {selectedPlan === 'annual' && (
                  <div className="absolute -top-2 left-4">
                    <div className="bg-indigo-600 text-white text-xs font-medium px-2 py-1 rounded">
                      {t('payment.popular', { defaultValue: 'Most Popular' })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        selectedPlan === 'annual'
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-gray-300"
                      )}>
                        {selectedPlan === 'annual' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">
                        {t('payment.annual', { defaultValue: 'Annual' })}
                      </span>
                      {(() => {
                        const monthly = 350;
                        const annual = 3500;
                        const pct = Math.round((1 - annual / (monthly * 12)) * 100);
                        return (
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 rounded">
                            {t('payment.save', { defaultValue: 'Save' })} {pct}%
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-gray-500 ml-6">
                      {t('payment.annualDesc', { defaultValue: 'Billed yearly' })} • ≈ EGP 290/month
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">EGP 3500</div>
                    <div className="text-xs text-gray-500">/year</div>
                  </div>
                </div>
              </button>
            </motion.div>

            {/* Sign In CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="space-y-4"
            >
              <Link
                to="/auth"
                className="w-full block"
              >
                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-4 rounded-2xl transition-colors">
                  {t('payment.signInToContinue', { defaultValue: 'Sign in to continue' })}
                </button>
              </Link>

              <p className="text-xs text-gray-500 text-center">
                {t('payment.signInDesc', { defaultValue: 'Create an account or sign in to unlock all features' })}
              </p>
            </motion.div>
          </>
        ) : (
          // Logged in user view
          <>
            {/* Main Plan Card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 text-white relative overflow-hidden"
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-soft-light" />

              {/* Price Badge */}
              <div className="absolute top-4 right-4 space-y-1 text-right rtl:left-4 rtl:right-auto rtl:text-left">
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 inline-block">
                  <span className="text-sm font-semibold">EGP 350/{t('payment.month', { defaultValue: 'mo' })}</span>
                </div>
                <div className="text-[10px] text-white/80">EGP 3500/{t('payment.year', { defaultValue: 'year' })}</div>
              </div>

              <div className="relative pr-20 rtl:pl-20 rtl:pr-0">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white">
                      {t('proPanel.plans.pro.name', { defaultValue: 'Pro Plan' })}
                    </h2>
                    <p className="text-blue-100 text-sm break-words">
                      {t('payment.subtitle', { defaultValue: 'Unlock unlimited access' })}
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {(t('payment.features', {
                    returnObjects: true,
                    defaultValue: [
                      'unlimited AI meal planning',
                      'Advanced nutrition tracking',
                      'Mood tracker',
                      'Hydration tracker',
                      'AI generated cardio & hydration suggestions',
                      'Progress analytics',
                      'Priority support'
                    ]
                  }) as string[]).map((feature, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-indigo-600" />
                      </div>
                      <span className="text-sm text-white/90">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Billing Options */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {t('payment.billingOptions', { defaultValue: 'Billing Options' })}
              </h3>

              {/* Monthly Option */}
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={cn(
                  "w-full bg-white rounded-2xl border p-4 transition-all duration-200 text-left",
                  selectedPlan === 'monthly'
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        selectedPlan === 'monthly'
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-gray-300"
                      )}>
                        {selectedPlan === 'monthly' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">
                        {t('payment.monthly', { defaultValue: 'Monthly' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 ml-6">
                      {t('payment.monthlyDesc', { defaultValue: 'Billed monthly' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">EGP 350</div>
                    <div className="text-xs text-gray-500">/month</div>
                  </div>
                </div>
              </button>

              {/* Annual Option - Highlighted */}
              <button
                onClick={() => setSelectedPlan('annual')}
                className={cn(
                  "w-full bg-white rounded-2xl border p-4 relative transition-all duration-200 text-left",
                  selectedPlan === 'annual'
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/50 border-2"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                {selectedPlan === 'annual' && (
                  <div className="absolute -top-2 left-4">
                    <div className="bg-indigo-600 text-white text-xs font-medium px-2 py-1 rounded">
                      {t('payment.popular', { defaultValue: 'Most Popular' })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        selectedPlan === 'annual'
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-gray-300"
                      )}>
                        {selectedPlan === 'annual' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">
                        {t('payment.annual', { defaultValue: 'Annual' })}
                      </span>
                      {(() => {
                        const monthly = 350;
                        const annual = 3500;
                        const pct = Math.round((1 - annual / (monthly * 12)) * 100);
                        return (
                          <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 rounded">
                            {t('payment.save', { defaultValue: 'Save' })} {pct}%
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-gray-500 ml-6">
                      {t('payment.annualDesc', { defaultValue: 'Billed yearly' })} • ≈ EGP 290/month
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">EGP 3500</div>
                    <div className="text-xs text-gray-500">/year</div>
                  </div>
                </div>
              </button>
            </motion.div>

            {/* Payment Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="space-y-4"
            >
              <button
                aria-label={t('payment.subscribeNow', { defaultValue: 'Subscribe Now' }) as string}
                onClick={handlePaymobPayment}
                className="w-full bg-white border border-white text-transparent font-medium py-4 rounded-full transition-all duration-200 flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
              >
                <img src={paymobLogo} alt="Paymob" className="h-5 w-auto" />
              </button>

              <div className="text-center space-y-2">
                <p className="text-xs text-gray-500">
                  {t('proPanel.checkout.secureViaPaymob', { defaultValue: 'Secure via Paymob' })}
                </p>
                <p className="text-[10px] text-gray-500">
                  {t('proPanel.checkout.agreePrefix')} {" "}
                  <a
                    href="https://dietin.fit/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-gray-900 transition-colors font-medium"
                  >
                    {t('auth.privacyPolicy')}
                  </a>{" "}
                  {t('proPanel.checkout.and')}{" "}
                  <a
                    href="https://dietin.fit/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-gray-900 transition-colors font-medium"
                  >
                    {t('auth.termsOfService')}
                  </a>
                </p>
              </div>

              {/* Redeem Code Button - Temporarily Hidden */}
              {/* <div className="flex justify-center pt-2">
                <button
                  onClick={() => setShowRedeemPopup(true)}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors font-medium"
                >
                  {t('proPanel.redeem.haveCode', { defaultValue: 'Have a redeem code?' })}
                </button>
              </div> */}
            </motion.div>
          </>
        )}
      </div>

      {/* Redeem Code Popup */}
      {isLoggedIn && (
        <AnimatePresence>
          {showRedeemPopup && (
            <>
              <NavHide isAIOpen={true} />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={() => setShowRedeemPopup(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 20 }}
                className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white rounded-t-xl border-t border-gray-100"
              >
                <div className="max-w-md mx-auto space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('proPanel.redeem.title', { defaultValue: 'Redeem Code' })}
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                      placeholder={t('proPanel.redeem.placeholder', { defaultValue: 'Enter code' })}
                      maxLength={12}
                      className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleRedeemCode}
                      disabled={isRedeeming}
                      className={cn(
                        "px-6 py-3 bg-indigo-600 text-white rounded-2xl transition font-medium hover:bg-indigo-700",
                        isRedeeming && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isRedeeming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('proPanel.redeem.action', { defaultValue: 'Redeem' })
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default Payment;
