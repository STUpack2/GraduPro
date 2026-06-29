import { Link } from "react-router-dom";
import { useEffect } from "react";
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface LoginPromptProps {
  lastPath?: string | null;
}

export default function LoginPrompt({ lastPath }: LoginPromptProps) {
  useEffect(() => {
    try { document.body.classList.add('no-scroll'); } catch {}
    return () => {
      try { document.body.classList.remove('no-scroll'); } catch {}
    };
  }, []);
  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full flex items-center justify-center pb-[3.5rem] relative">
      {/* Language Switcher - top right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <Link 
        to="/auth" 
        className="px-5 py-2.5 rounded-full font-medium text-white text-sm bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:opacity-90 transition-opacity shadow-xl"
      >
        Sign in to continue
      </Link>
    </div>
  );
}