import { Home, ClipboardList, LineChart, Dumbbell, User, Settings } from 'lucide-react';

export const routes = [
  {
    name: "Home",
    path: "/",
    icon: Home
  },
  {
    name: "Tracker",
    path: "/diet",
    icon: ClipboardList
  },
  {
    name: "Progress",
    path: "/progress",
    icon: LineChart
  },
  {
    name: "Workouts",
    path: "/workouts",
    icon: Dumbbell
  },
  {
    name: "Profile",
    path: "/profile",
    icon: User
  },
  {
    name: "Custom Plan",
    path: "/custom-plan",
    icon: Settings
  }
]; 