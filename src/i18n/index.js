import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import uk from './locales/uk.json'

// Cookie helpers for language persistence
const COOKIE_NAME = 'preferredLanguage'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

function setCookie(name, value, maxAge) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
}

// Get saved language preference from cookie, fallback to 'en'
const savedLanguage = getCookie(COOKIE_NAME) || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      uk: { translation: uk }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  })

// Listen for language changes and save to cookie
i18n.on('languageChanged', (lng) => {
  setCookie(COOKIE_NAME, lng, COOKIE_MAX_AGE)
})

export default i18n
