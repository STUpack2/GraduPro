import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import { onAuthStateChanged } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ProgressChart = () => {
  const { user, updateUser } = useUserStore();
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newHeight, setNewHeight] = useState('');
  // Initialize cache (per-user if signed in). Avoid showing example cache for Pro users.
  const initialCached = (() => {
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const rawUser = sessionStorage.getItem(`progressHistory:${uid}`);
        if (rawUser) {
          const parsed = JSON.parse(rawUser) as { data: { weight: number; height: number; timestamp: string }[] };
          if (parsed && Array.isArray(parsed.data)) return parsed;
        }
        // Do not fall back to generic cache for Pro users; render empty until Firestore loads
        return { data: [] } as { data: { weight: number; height: number; timestamp: string }[] };
      } else {
        // Not signed-in: use generic cache only if not Pro (example mode)
        if (!user?.isPro) {
          const raw = sessionStorage.getItem('progressHistory:last');
          if (raw) {
            const parsed = JSON.parse(raw) as { data: { weight: number; height: number; timestamp: string }[] };
            if (parsed && Array.isArray(parsed.data)) return parsed;
          }
        }
        return { data: [] };
      }
    } catch {
      return { data: [] };
    }
  })();
  const [progressHistory, setProgressHistory] = useState<{ data: { weight: number; height: number; timestamp: string }[] }>(initialCached);
  const [isLoading, setIsLoading] = useState(false);
  // Track if we've ever successfully loaded data in this mount
  const hasLoadedOnce = useRef(false);
  const [everLoaded, setEverLoaded] = useState(Boolean(initialCached?.data?.length)); // suppress loader if we had cache
  // Track last data signature to avoid redundant state updates that cause flicker
  const lastSigRef = useRef<string>("-");

  const makeSignature = (arr: { weight: number; height: number; timestamp: string }[]) => {
    if (!arr || arr.length === 0) return '0';
    const last = arr[arr.length - 1];
    return `${arr.length}|${last.timestamp}|${last.weight}|${last.height}`;
  };

  useEffect(() => {
    // Only when explicitly non-Pro show local example data (avoid pro/undefined flicker)
    if (user?.isPro === false) {
      const example = Array.from({ length: 7 }, (_, i) => {
        const base = 75; // kg
        const weight = base - (6 - i) * 0.3; // slight trend
        const height = 175; // cm constant
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return { weight: Math.round(weight * 10) / 10, height, timestamp: d.toISOString() };
      });
      // Set only if different from current to avoid needless rerender
      const sig = makeSignature(example);
      if (sig !== lastSigRef.current) {
        const next = { data: example };
        setProgressHistory(next);
        lastSigRef.current = sig;
        try { sessionStorage.setItem('progressHistory:last', JSON.stringify(next)); } catch {}
      }
      setIsLoading(false);
      hasLoadedOnce.current = true;
      setEverLoaded(true);
      return;
    }

    // Subscribe once auth is ready; this makes loading more reliable and keeps data in sync
    if (!hasLoadedOnce.current) setIsLoading(true);
    let isMounted = true;
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // If auth user changes, remove previous doc listener first
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!firebaseUser?.uid) {
        if (isMounted) {
          setProgressHistory({ data: [] });
          setIsLoading(false);
        }
        return;
      }

      // Try session cache first to avoid flicker on remount
      try {
        const cacheKey = `progressHistory:${firebaseUser.uid}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { data: { weight: number; height: number; timestamp: string }[] };
          if (parsed?.data?.length) {
            setProgressHistory(parsed);
            setIsLoading(false);
            hasLoadedOnce.current = true;
            setEverLoaded(true);
          }
        }
      } catch {}

      const userRef = doc(db, 'users', firebaseUser.uid);
      unsubscribeDoc = onSnapshot(
        userRef,
        (snap) => {
          if (!isMounted) return;
          const data = snap.data();
          const history = (data?.progressHistory as { data: any[] } | undefined) || { data: [] };
          const sig = makeSignature(history.data as any);
          if (sig !== lastSigRef.current) {
            setProgressHistory(history);
            lastSigRef.current = sig;
            // Only write generic cache for non-Pro (example mode). Always write per-user cache below.
            try { if (!user?.isPro) sessionStorage.setItem('progressHistory:last', JSON.stringify(history)); } catch {}
          }
          setIsLoading(false);
          hasLoadedOnce.current = true;
          setEverLoaded(true);
          // write to session cache
          try {
            const cacheKey = `progressHistory:${firebaseUser.uid}`;
            sessionStorage.setItem(cacheKey, JSON.stringify(history));
            // For Pro users, avoid leaking generic cache from previous anonymous session
            if (!user?.isPro) sessionStorage.setItem('progressHistory:last', JSON.stringify(history));
          } catch {}
        },
        (error) => {
          if (!isMounted) return;
          console.error('Realtime progress history error:', error);
          toast.error(t('profile.progress.toast.loadError'));
          setIsLoading(false);
        }
      );
    });

    return () => {
      isMounted = false;
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeAuth();
    };
  }, [user?.isPro, t]);

  const handleUpdateProgress = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid || !newWeight || !newHeight) return;

    setIsLoading(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const currentData = userDoc.data().progressHistory?.data || [];
        const newEntry = {
          weight: parseFloat(newWeight),
          height: parseFloat(newHeight),
          timestamp: new Date().toISOString()
        };

        // Try to update with retry logic
        const MAX_RETRIES = 3;
        let retryCount = 0;
        let success = false;

        while (retryCount < MAX_RETRIES && !success) {
          try {
            await updateDoc(userRef, {
              'progressHistory.data': [...currentData, newEntry],
              'weight': parseFloat(newWeight),
              'height': parseFloat(newHeight),
              'updatedAt': new Date().toISOString()
            });
            
            success = true;
            
            setProgressHistory(prev => ({
              data: [...prev.data, newEntry]
            }));
            try {
              const uid = currentUser.uid;
              const cacheKey = `progressHistory:${uid}`;
              const existing = sessionStorage.getItem(cacheKey);
              const parsed = existing ? JSON.parse(existing) as { data: any[] } : { data: [] };
              sessionStorage.setItem(cacheKey, JSON.stringify({ data: [...parsed.data, newEntry] }));
            } catch {}

            // Update user store
            updateUser({
              weight: parseFloat(newWeight),
              height: parseFloat(newHeight)
            });

            setNewWeight('');
            setNewHeight('');
            setIsUpdating(false);
            toast.success(t('profile.progress.toast.saved'));
            
          } catch (error) {
            retryCount++;
            console.error(`Error updating progress (attempt ${retryCount}/${MAX_RETRIES}):`, error);
            
            if (retryCount < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
              toast.error(t('profile.progress.toast.saveError'));
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in update progress flow:", error);
      toast.error(t('profile.progress.toast.unknownError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Limit the number of points rendered to reduce chart workload
  const limitedData = useMemo(() => progressHistory.data.slice(-60), [progressHistory.data]);

  const chartData = useMemo(() => ({
    labels: limitedData.map(entry => format(new Date(entry.timestamp), 'MMM d')),
    datasets: [
      {
        id: 'weight',
        label: t('profile.progress.weight_label'),
        data: limitedData.map(entry => entry.weight),
        borderColor: 'rgba(168, 85, 247, 0.8)',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        pointBackgroundColor: 'rgba(168, 85, 247, 1)',
        pointBorderColor: '#fff',
        tension: 0.4,
        fill: true,
        yAxisID: 'y'
      },
      {
        id: 'height',
        label: t('profile.progress.height_label'),
        data: limitedData.map(entry => entry.height),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        tension: 0.4,
        fill: true,
        yAxisID: 'y'
      }
    ]
  }), [limitedData, t]);

  // Y-axis range cache (must be declared before chartOptions uses it)
  const lastYRangeRef = useRef<{ min: number; max: number } | null>(null);

  const chartOptions = useMemo(() => ({
    // Responsive again; we keep the canvas mounted to avoid flicker
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    animations: {
      colors: false,
      x: false,
      y: false
    } as any,
    scales: {
      x: {
        type: 'category' as const,
        grid: {
          color: 'rgba(17, 24, 39, 0.1)',
        },
        ticks: {
          color: 'rgba(17, 24, 39, 0.6)',
          font: {
            size: 10
          }
        }
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: {
          color: 'rgba(17, 24, 39, 0.1)',
        },
        ticks: {
          color: 'rgba(17, 24, 39, 0.6)',
          font: {
            size: 10
          }
        },
        title: {
          display: true,
          text: t('profile.progress.yAxisValue')
        },
        suggestedMin: lastYRangeRef.current?.min,
        suggestedMax: lastYRangeRef.current?.max
      }
    },
    plugins: {
      legend: {
        labels: {
          color: 'rgba(17, 24, 39, 0.9)',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: 'rgba(17, 24, 39, 0.9)',
        bodyColor: 'rgba(17, 24, 39, 0.9)',
        padding: 10,
        boxPadding: 4,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value}`;
          }
        }
      }
    }
  }), [t]);

  // Keep last non-empty chart data to avoid canvas unmount/remount flicker
  const lastNonEmptyChartDataRef = useRef<typeof chartData | null>(null);
  useEffect(() => {
    if (limitedData.length > 0) {
      lastNonEmptyChartDataRef.current = chartData;
    }
  }, [limitedData, chartData]);

  const stableChartData = useMemo(() => {
    if (limitedData.length > 0) return chartData;
    return lastNonEmptyChartDataRef.current || chartData; // fallback to current (possibly empty)
  }, [limitedData.length, chartData]);

  // Stabilize y-axis range to avoid rescale flicker between quick updates
  useEffect(() => {
    const src = limitedData.length > 0 ? limitedData : (lastNonEmptyChartDataRef.current
      ? (lastNonEmptyChartDataRef.current.datasets[0].data as number[]).map((v, i) => ({ weight: v as number, height: (lastNonEmptyChartDataRef.current!.datasets[1].data as number[])[i] as number, timestamp: '' }))
      : []);
    if (src.length === 0) return;
    const weights = src.map(d => d.weight).filter(n => Number.isFinite(n));
    const heights = src.map(d => d.height).filter(n => Number.isFinite(n));
    const all = [...weights, ...heights];
    if (!all.length) return;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || 1;
    const next = { min: min - pad, max: max + pad };
    lastYRangeRef.current = next;
  }, [limitedData, stableChartData]);

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{t('profile.progress.title')}</h3>
            <p className="text-sm text-gray-600 mt-1">{t('profile.progress.subtitle')}</p>
          </div>
          {user?.isPro && (
            <button
              onClick={() => setIsUpdating(true)}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors border border-gray-200"
            >
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>

        {user?.isPro && isUpdating ? (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.progress.input.weightLabel')}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder={user?.weight ? t('profile.progress.input.currentWeight', { value: user.weight }) : t('profile.progress.input.enterWeight')}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.progress.input.heightLabel')}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={newHeight}
                    onChange={(e) => setNewHeight(e.target.value)}
                    placeholder={user?.height ? t('profile.progress.input.currentHeight', { value: user.height }) : t('profile.progress.input.enterHeight')}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpdateProgress}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-300"
                disabled={isLoading || !newWeight || !newHeight}
              >
                {isLoading ? t('profile.progress.actions.saving') : t('profile.progress.actions.saveUpdate')}
              </button>
              <button
                onClick={() => {
                  setIsUpdating(false);
                  setNewWeight('');
                  setNewHeight('');
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100"
                disabled={isLoading}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative h-[300px]">
          <Line data={stableChartData} options={chartOptions} redraw={false} datasetIdKey="id" height={300} />

          {isLoading && !everLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200"></div>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('profile.progress.loadingTitle')}</h4>
            </div>
          )}

          {!isLoading && progressHistory.data.length === 0 && everLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-gray-200">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('profile.progress.emptyTitle')}</h4>
              <p className="text-sm text-gray-600">{t('profile.progress.emptyDesc')}</p>
            </div>
          )}
        </div>

        {/* Pro lock label for non-Pro */}
        {!user?.isPro && (
          <div className="mt-4 p-3 rounded-lg border border-dashed border-purple-300 bg-purple-50 text-purple-800 text-sm">
            {t('pro.locked.desc')}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ProgressChart);