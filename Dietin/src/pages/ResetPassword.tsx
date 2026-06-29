import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Loader2, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useQuery();

  const [status, setStatus] = useState<'idle' | 'verifying' | 'ready' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const oobCode = query.get('oobCode') || '';
  const mode = (query.get('mode') || '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!oobCode || mode !== 'resetpassword') {
        setStatus('error');
        setErrorMsg(t('reset.invalid_link', 'Invalid or missing reset link.'));
        return;
      }
      try {
        setStatus('verifying');
        const mail = await verifyPasswordResetCode(auth, oobCode);
        if (cancelled) return;
        setEmail(mail || '');
        setStatus('ready');
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.message || t('reset.something_wrong', 'This link may be invalid or expired.'));
        setStatus('error');
      }
    };
    run();
    return () => { cancelled = true; };
  }, [oobCode, mode, t]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setErrorMsg(t('reset.password_too_short', 'Please choose a password with at least 8 characters.'));
      return;
    }
    if (password !== confirm) {
      setErrorMsg(t('reset.passwords_mismatch', "Passwords don't match."));
      return;
    }
    try {
      setSubmitting(true);
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg(e?.message || t('reset.update_failed', 'Could not update password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white/80 dark:bg-neutral-900/70 backdrop-blur-2xl shadow-2xl border border-black/5 dark:border-white/5 p-8 text-center">
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="text-xl font-semibold">
              {t('reset.title_verifying', 'Validating reset link...')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('reset.subtitle_verifying', 'Please wait a moment.')}  
            </p>
          </div>
        )}

        {status === 'ready' && (
          <div>
            <div className="flex flex-col items-center gap-4">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                <Lock className="h-8 w-8" />
              </div>
              <h1 className="text-xl font-semibold">
                {t('reset.title', 'Reset your password')}
              </h1>
              {email && (
                <p className="text-xs text-muted-foreground">{t('reset.for_email', 'For')}: {email}</p>
              )}
            </div>

            <form onSubmit={onSubmit} className="mt-5 text-left space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('reset.new_password', 'New password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder={t('reset.password_placeholder', '••••••••')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('reset.confirm_password', 'Confirm password')}</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder={t('reset.password_placeholder', '••••••••')}
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-5 py-3 font-medium shadow-sm hover:opacity-95 transition disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {t('reset.update_password', 'Update password')}
              </button>

              {/* No navigation buttons; keep page isolated */}
            </form>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-semibold">
              {t('reset.title_success', 'Password updated!')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('reset.subtitle_success', 'You can now sign in with your new password.')}
            </p>
            {/* Keep the page isolated: no navigation buttons */}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-semibold">
              {t('reset.title_error', 'Reset problem')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorMsg || t('reset.subtitle_error', 'This link may be invalid or expired.')}
            </p>
            {/* Keep the page isolated: no navigation buttons */}
          </div>
        )}
      </div>
    </div>
  );
}
