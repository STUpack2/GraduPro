import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '@/lib/firebase';
import { useNavigate } from 'react-router-dom';

export default function PaymentReturn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');
  const [expires, setExpires] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        // Wait a moment to allow webhook to process
        await new Promise(r => setTimeout(r, 1200));
        const functions = getFunctions(app, 'us-central1');
        const getEntitlement = httpsCallable(functions, 'get_entitlement');
        if (!auth.currentUser) {
          setStatus('failed');
          return;
        }
        const res: any = await getEntitlement({});
        const data = res?.data;
        if (data?.isPro) {
          setStatus('success');
          if (data?.proExpiresAt?.seconds) {
            const d = new Date(data.proExpiresAt.seconds * 1000);
            setExpires(d.toLocaleString());
          }
        } else {
          setStatus('failed');
        }
      } catch (e) {
        console.error('Verification error', e);
        setStatus('failed');
        toast({
          title: t('payment.verifyErrorTitle', { defaultValue: 'Verification error' }),
          description: t('payment.verifyErrorDesc', { defaultValue: 'We could not verify your payment yet. If you already paid, wait a minute and refresh.' }),
          variant: 'destructive'
        });
      }
    };
    verify();
  }, [t]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 text-center">
        {status === 'checking' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-gray-700 font-medium">{t('payment.verifying', { defaultValue: 'Verifying your payment…' })}</p>
            <p className="text-xs text-gray-500">{t('payment.verifyingHint', { defaultValue: 'This may take a few seconds.' })}</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-gray-900 font-semibold">{t('payment.verified', { defaultValue: 'Payment verified!' })}</p>
            {expires && <p className="text-xs text-gray-500">{t('payment.expires', { defaultValue: 'Expires:' })} {expires}</p>}
            <button onClick={() => navigate('/home')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">{t('common.continue', { defaultValue: 'Continue' })}</button>
          </div>
        )}
        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-red-600" />
            <p className="text-gray-900 font-semibold">{t('payment.notVerified', { defaultValue: 'Payment not verified' })}</p>
            <p className="text-xs text-gray-500">{t('payment.notVerifiedHint', { defaultValue: 'If you already paid, wait a minute and refresh this page.' })}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-100 rounded-lg">{t('common.refresh', { defaultValue: 'Refresh' })}</button>
              <button onClick={() => navigate('/payment')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{t('common.tryAgain', { defaultValue: 'Try again' })}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
