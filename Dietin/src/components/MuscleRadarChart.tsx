import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { cn } from '../lib/utils';
import { useUserStore } from '@/stores/userStore';
import { useTranslation } from 'react-i18next';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface WorkoutHistory {
  date: string;
  muscleGroup: string;
  exercises: {
    name: string;
    musclesWorked: string[];
    setsCompleted: number;
    totalSets: number;
  }[];
  completionPercentage: number;
}

const MuscleRadarChart = () => {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const [muscleFrequency, setMuscleFrequency] = useState<{ [key: string]: number }>({
    'Chest': 0,
    'Back': 0,
    'Shoulders': 0,
    'Arms': 0,
    'Legs': 0,
    'Core': 0
  });
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const calculateMuscleFrequency = () => {
      // For non-Pro users: show local example/demo data only
      if (!user?.isPro) {
        const example: { [key: string]: number } = {
          'Chest': 65,
          'Back': 55,
          'Shoulders': 48,
          'Arms': 60,
          'Legs': 70,
          'Core': 40
        };
        setMuscleFrequency(example);
        setHasData(true);
        return;
      }

      const savedWorkoutHistory = localStorage.getItem('workoutHistory');
      if (!savedWorkoutHistory) {
        setHasData(false);
        return;
      }

      const workoutHistory = JSON.parse(savedWorkoutHistory);
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Reset muscle frequency
      const initialMuscleFrequency = {
        'Chest': 0,
        'Back': 0,
        'Shoulders': 0,
        'Arms': 0,
        'Legs': 0,
        'Core': 0
      };

      // Filter workouts for current month
      const monthlyWorkouts = workoutHistory.filter((workout: any) => {
        const workoutDate = new Date(workout.date);
        return workoutDate.getMonth() === currentMonth &&
               workoutDate.getFullYear() === currentYear;
      });

      if (monthlyWorkouts.length > 0) {
        setHasData(true);
        
        // Calculate frequency for each muscle group
        monthlyWorkouts.forEach((workout: any) => {
          if (!workout.exercises || !Array.isArray(workout.exercises)) return;
          
          workout.exercises.forEach((exercise: any) => {
            if (!exercise.musclesWorked || !Array.isArray(exercise.musclesWorked)) return;
            
            // Track total volume for this exercise
            const setVolume = exercise.setsCompleted && exercise.totalSets 
              ? exercise.setsCompleted / exercise.totalSets 
              : 0;
            
            exercise.musclesWorked.forEach((muscle: string) => {
              const muscleCategory = getMuscleCategory(muscle);
              if (muscleCategory && initialMuscleFrequency.hasOwnProperty(muscleCategory)) {
                // Normalize the volume to percentage (0-100)
                initialMuscleFrequency[muscleCategory] += (setVolume * 100) / monthlyWorkouts.length;
              }
            });
          });
        });

        setMuscleFrequency(initialMuscleFrequency);
      } else {
        setHasData(false);
      }
    };

    calculateMuscleFrequency();
  }, []);

  // Helper function to categorize muscles into main groups
  const getMuscleCategory = (muscle: string): string | null => {
    const categories: { [key: string]: string[] } = {
      'Chest': ['chest', 'pectorals', 'pecs'],
      'Back': ['back', 'lats', 'traps', 'rhomboids', 'latissimus'],
      'Shoulders': ['shoulders', 'deltoids', 'delts'],
      'Arms': ['biceps', 'triceps', 'forearms', 'arm'],
      'Legs': ['quadriceps', 'hamstrings', 'calves', 'glutes', 'quads', 'legs', 'leg'],
      'Core': ['abdominals', 'abs', 'core', 'lower back', 'obliques']
    };

    const muscleLower = muscle.toLowerCase().trim();
    for (const [category, muscles] of Object.entries(categories)) {
      if (muscles.some(m => muscleLower.includes(m))) {
        return category;
      }
    }
    return null;
  };

  const data = {
    labels: Object.keys(muscleFrequency).map((k) => t(`profile.muscleRadar.labels.${k}`)),
    datasets: [
      {
        label: t('profile.muscleRadar.datasetLabel'),
        data: Object.values(muscleFrequency),
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        borderColor: 'rgba(168, 85, 247, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(168, 85, 247, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(168, 85, 247, 1)',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true
      }
    ]
  };

  const options = {
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(17, 24, 39, 0.1)',
          circular: true
        },
        angleLines: {
          color: 'rgba(17, 24, 39, 0.1)',
          lineWidth: 1
        },
        pointLabels: {
          color: 'rgba(17, 24, 39, 0.9)',
          font: {
            size: 12,
            weight: 500 as const,
            family: 'system-ui'
          }
        },
        ticks: {
          stepSize: 20,
          color: 'rgba(17, 24, 39, 0.6)',
          backdropColor: 'transparent',
          font: {
            size: 10
          },
          callback: function(value: number) {
            return value + '%';
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: 'rgba(17, 24, 39, 0.9)',
        bodyColor: 'rgba(17, 24, 39, 0.9)',
        padding: 10,
        boxPadding: 4,
        callbacks: {
          label: (context: any) => {
            return `${t('profile.muscleRadar.tooltip.volume')}: ${context.raw.toFixed(0)}%`;
          }
        }
      }
    },
    elements: {
      line: {
        tension: 0.6
      }
    },
    responsive: true,
    maintainAspectRatio: true
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">{t('profile.muscleRadar.title')}</h3>
          <p className="text-sm text-gray-600">
            {hasData ? t('profile.muscleRadar.subtitleWithData') : t('profile.muscleRadar.subtitleNoData')}
          </p>
          {!user?.isPro && (
            <div className="mt-3 p-3 rounded-lg border border-dashed border-purple-300 bg-purple-50 text-purple-800 text-sm">
              {t('pro.locked.desc')}
            </div>
          )}
        </div>
        
        <div className="w-full aspect-square max-w-md mx-auto">
          {hasData ? (
            <Radar data={data} options={options} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 border border-gray-200">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('profile.muscleRadar.emptyTitle')}</h4>
              <p className="text-sm text-gray-600">{t('profile.muscleRadar.emptyDesc')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MuscleRadarChart; 