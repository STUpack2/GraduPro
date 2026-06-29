import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';

export default function Navigation() {
  const location = useLocation();

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        {/* Navigation content */}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-white/[0.08] pb-safe">
      </nav>
    </>
  );
} 