import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  // Normalize current language to supported set
  const current = useMemo(() => {
    const lang = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'ar-EG' : 'en';
  }, [i18n.language, i18n.resolvedLanguage]);

  // Apply dir and html lang whenever current changes
  useEffect(() => {
    try {
      const isArabic = current.toLowerCase().startsWith('ar');
      document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
      document.documentElement.lang = current;
    } catch {}
  }, [current]);

  // Restore saved language on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_language');
      if (saved === 'en' || saved === 'ar-EG') {
        const active = i18n.resolvedLanguage || i18n.language;
        if (active !== saved) {
          i18n.changeLanguage(saved);
        }
        const isArabic = saved.toLowerCase().startsWith('ar');
        document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
        document.documentElement.lang = saved;
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (value: string) => {
    // Only allow 'en' and 'ar-EG'
    if (value === 'en' || value === 'ar-EG') {
      i18n.changeLanguage(value);
      try {
        localStorage.setItem('app_language', value);
        const isArabic = value.toLowerCase().startsWith('ar');
        document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
        document.documentElement.lang = value;
      } catch {}
    }
  };

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="h-10 min-w-[160px] bg-white border border-gray-200 text-gray-900 rounded-xl shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-primary/20">
        <SelectValue placeholder="Language" aria-label="Select language" />
      </SelectTrigger>
      <SelectContent className="bg-white/95 backdrop-blur-xl border-gray-200 rounded-xl shadow-lg">
        <SelectItem value="en" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">English</SelectItem>
        <SelectItem value="ar-EG" className="text-gray-900 hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">العربية (مصر)</SelectItem>
      </SelectContent>
    </Select>
  );
};