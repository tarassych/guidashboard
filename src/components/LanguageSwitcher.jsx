import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

// Language configurations with flag emojis
const languages = [
  { code: 'en', name: 'EN', flag: '🇬🇧', fullName: 'English' }
  // Add more languages here as they become available:
  // { code: 'uk', name: 'UA', flag: '🇺🇦', fullName: 'Українська' },
  // { code: 'de', name: 'DE', flag: '🇩🇪', fullName: 'Deutsch' },
  // { code: 'es', name: 'ES', flag: '🇪🇸', fullName: 'Español' },
]

function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  // Get current language config
  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0]
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
    // Persist language choice
    localStorage.setItem('preferredLanguage', langCode)
  }
  
  // Only show dropdown if more than one language is available
  const showDropdown = languages.length > 1
  
  return (
    <div className="language-switcher" ref={dropdownRef}>
      <button 
        className={`lang-btn ${isOpen ? 'open' : ''}`}
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        title={currentLang.fullName}
      >
        <span className="lang-flag">{currentLang.flag}</span>
        <span className="lang-code">{currentLang.name}</span>
        {showDropdown && <span className="lang-arrow">▼</span>}
      </button>
      
      {isOpen && showDropdown && (
        <div className="lang-dropdown">
          {languages.map(lang => (
            <button
              key={lang.code}
              className={`lang-option ${lang.code === i18n.language ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span className="lang-code">{lang.name}</span>
              <span className="lang-full-name">{lang.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher

