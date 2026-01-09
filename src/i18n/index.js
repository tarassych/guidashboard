import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

// Get saved language preference or default to 'en'
const savedLanguage = typeof window !== 'undefined' 
  ? localStorage.getItem('preferredLanguage') || 'en'
  : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en }
      // Add more languages here:
      // uk: { translation: uk }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  })

export default i18n

