import { Home, Dumbbell, UserCircle2, LineChart, ClipboardList } from 'lucide-react';

export const routes = [
  {
    name: 'Home',
    path: '/',
    icon: Home
  },
  {
    name: 'Workouts',
    path: '/workouts',
    icon: Dumbbell
  },
  {
    name: 'Tracker',
    path: '/diet',
    icon: LineChart
  },
  {
    name: 'Profile',
    path: '/profile',
    icon: UserCircle2
  }
]; 