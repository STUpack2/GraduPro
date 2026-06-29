import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { applyActionCode, reload, checkActionCode } from 'firebase/auth';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function VerifyEmail() {
  const { t } = useTranslation();
  const query = useQuery();

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const oobCode = query.get('oobCode') || '';
  const mode = (query.get('mode') || '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!oobCode) {
        setStatus('error');
        setErrorMsg(t('verify.invalid_link', 'Invalid or missing verification link.'));
        return;
      }
      try {
        setStatus('verifying');
        // Validate the code first for clearer errors
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        try { await reload(auth.currentUser!); } catch {}
        // If user is present and verified after reload, mark success
        const u = auth.currentUser;
        if (u && u.emailVerified) {
          if (cancelled) return;
          setStatus('success');
        } else {
          // Even if not signed in, the code was applied. Show success and allow login.
          if (cancelled) return;
          setStatus('success');
        }
      } catch (e: any) {
        // Map common Firebase errors to friendlier messages
        let friendly = t('verify.something_wrong', 'Something went wrong verifying your email.');
        const code = e?.code || e?.message || '';
        if (String(code).includes('expired-action-code')) {
          friendly = t('verify.link_expired', 'This link has expired. Please request a new verification email.');
        } else if (String(code).includes('invalid-action-code')) {
          friendly = t('verify.invalid_link', 'This verification link is invalid. Please open the latest email.');
        }
        console.error('Verification error:', e);
        if (cancelled) return;
        setErrorMsg(friendly);
        setStatus('error');
      }
    };
    run();
    return () => { cancelled = true; };
  }, [oobCode, mode, t]);

  // Intentionally no action buttons; page stays isolated and minimal

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12 bg-gradient-to-b from-indigo-50 to-white dark:from-neutral-900 dark:to-neutral-950">
      <div className="w-full max-w-md rounded-3xl bg-white/85 dark:bg-neutral-900/70 backdrop-blur-2xl shadow-xl border border-black/5 dark:border-white/5 p-8 text-center">
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="text-xl font-semibold">
              {t('verify.title_verifying', 'Verifying your email...')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('verify.subtitle_verifying', 'Please wait a moment while we complete the process.')}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-semibold">
              {t('verify.title_success', 'Email verified!')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('verify.subtitle_success', 'Great! Your email address has been successfully verified.')}
            </p>
            {/* Isolated page: no navigation buttons */}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-semibold">
              {t('verify.title_error', 'Verification problem')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorMsg || t('verify.subtitle_error', 'This link may be invalid or expired.')}
            </p>
            {/* Isolated page: no action buttons */}
          </div>
        )}
      </div>
    </div>
  );
}
