import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import arTranslations from './locales/ar.json';
import arEGTranslations from './locales/ar-EG.json';

// Initialize language and RTL from localStorage or default to 'en'
const savedLanguage = localStorage.getItem('i18nextLng') || 'en';
const isArabic = savedLanguage?.startsWith('ar');
document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
document.body.classList.toggle('rtl', !!isArabic);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      ar: {
        translation: arTranslations,
      },
      'ar-EG': {
        translation: arEGTranslations,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'ar-EG'],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

// Listen for language changes
i18n.on('languageChanged', (lng) => {
  const rtl = lng?.startsWith('ar');
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', !!rtl);
  localStorage.setItem('i18nextLng', lng);
});

export default i18n; 