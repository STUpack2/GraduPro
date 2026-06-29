import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';
import { useUserStore } from '@/stores/userStore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useTranslation } from 'react-i18next';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DailyMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
}

const MacroBarChart = () => {
  const { getDailyCalories, user } = useUserStore();
  const [weeklyData, setWeeklyData] = useState<DailyMacros[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    // For non-Pro users, show local example data only (no store access)
    if (!user?.isPro) {
      const example = [] as DailyMacros[];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        // Simple consistent demo pattern
        const base = 1800 + i * 20;
        example.push({
          calories: base,
          protein: Math.round((base * 0.25) / 4),
          carbs: Math.round((base * 0.5) / 4),
          fat: Math.round((base * 0.25) / 9),
          date
        });
      }
      setWeeklyData(example);
      return;
    }

    // Pro: Get last 7 days of real data
    const data = [] as DailyMacros[];
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const dailyData = getDailyCalories(date);
      data.push({
        calories: dailyData?.totalCalories || 0,
        protein: dailyData?.totalProtein || 0,
        carbs: dailyData?.totalCarbs || 0,
        fat: dailyData?.totalFat || 0,
        date
      });
    }
    setWeeklyData(data);
  }, [getDailyCalories, user?.isPro]);

  const chartData = {
    labels: weeklyData.map(day => format(new Date(day.date), 'EEE')),
    datasets: [
      {
        label: t('profile.macroBar.labels.calories'),
        data: weeklyData.map(day => day.calories),
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0'
      },
      {
        label: t('profile.macroBar.labels.protein'),
        data: weeklyData.map(day => day.protein * 4), // Convert to calories (4 cal/g)
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 1'
      },
      {
        label: t('profile.macroBar.labels.carbs'),
        data: weeklyData.map(day => day.carbs * 4), // Convert to calories (4 cal/g)
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 1'
      },
      {
        label: t('profile.macroBar.labels.fat'),
        data: weeklyData.map(day => day.fat * 9), // Convert to calories (9 cal/g)
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 1'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          color: 'rgba(17, 24, 39, 0.1)',
        },
        ticks: {
          color: 'rgba(17, 24, 39, 0.6)',
          font: {
            size: 12
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(17, 24, 39, 0.1)',
        },
        ticks: {
          color: 'rgba(17, 24, 39, 0.6)',
          font: {
            size: 12
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgba(17, 24, 39, 0.9)',
          font: {
            size: 12
          },
          usePointStyle: true,
          pointStyle: 'circle'
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
            const value = context.raw;
            const label = context.dataset.label as string;
            const calUnit = t('profile.macroBar.units.cal');
            const gramUnit = t('profile.macroBar.units.gram');
            // Compare against translated calories label as dataset labels are localized
            if (label === t('profile.macroBar.labels.calories')) {
              return `${label}: ${Math.round(value)} ${calUnit}`;
            } else {
              const isFat = label === t('profile.macroBar.labels.fat');
              const grams = isFat ? value / 9 : value / 4;
              return `${label}: ${Math.round(grams)}${gramUnit} (${Math.round(value)} ${calUnit})`;
            }
          }
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">{t('profile.macroBar.title')}</h3>
          <p className="text-sm text-gray-600 mt-1">{t('profile.macroBar.subtitle')}</p>
          {!user?.isPro && (
            <div className="mt-3 p-3 rounded-lg border border-dashed border-purple-300 bg-purple-50 text-purple-800 text-sm">
              {t('pro.locked.desc')}
            </div>
          )}
        </div>
        <div className="h-[300px]">
          <Bar data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
};

export default MacroBarChart;