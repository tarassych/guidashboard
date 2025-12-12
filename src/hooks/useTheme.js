import { useState, useEffect, useCallback, useRef } from 'react'
import config from '../config'

/**
 * Custom hook for dynamic theme management
 * 
 * @param {Object} telemetryData - Current telemetry data for condition-based switching
 * @returns {Object} - { currentTheme, setTheme, isLoading }
 */
export function useTheme(telemetryData = null) {
  const [currentTheme, setCurrentTheme] = useState(config.defaultTheme)
  const [isLoading, setIsLoading] = useState(true)
  const loadedThemesRef = useRef(new Set())
  const styleElementRef = useRef(null)
  const manualOverrideRef = useRef(false)

  // Load and apply a theme
  const loadTheme = useCallback(async (themeName) => {
    if (!config.themes[themeName]) {
      console.warn(`Theme "${themeName}" not found. Available: ${Object.keys(config.themes).join(', ')}`)
      return false
    }

    setIsLoading(true)
    
    try {
      // Dynamic import of theme CSS
      await config.themes[themeName]()
      
      // Mark as loaded
      loadedThemesRef.current.add(themeName)
      
      // Update body class for theme identification
      document.body.className = document.body.className
        .split(' ')
        .filter(c => !c.startsWith('theme-'))
        .concat(`theme-${themeName}`)
        .join(' ')
        .trim()
      
      setCurrentTheme(themeName)
      setIsLoading(false)
      return true
    } catch (error) {
      console.error(`Failed to load theme "${themeName}":`, error)
      setIsLoading(false)
      return false
    }
  }, [])

  // Manual theme setter (disables auto-switching temporarily)
  const setTheme = useCallback((themeName, disableAuto = true) => {
    if (disableAuto) {
      manualOverrideRef.current = true
    }
    return loadTheme(themeName)
  }, [loadTheme])

  // Re-enable automatic theme switching
  const enableAutoTheme = useCallback(() => {
    manualOverrideRef.current = false
  }, [])

  // Load initial theme on mount
  useEffect(() => {
    loadTheme(config.defaultTheme)
  }, [loadTheme])

  // Check telemetry conditions for automatic theme switching
  useEffect(() => {
    if (!telemetryData || manualOverrideRef.current) return

    const conditions = config.themeConditions
    for (const [, config] of Object.entries(conditions)) {
      try {
        if (config.condition(telemetryData) && currentTheme !== config.theme) {
          loadTheme(config.theme)
          break
        }
      } catch (e) {
        // Condition check failed, skip
      }
    }
  }, [telemetryData, currentTheme, loadTheme])

  return {
    currentTheme,
    setTheme,
    enableAutoTheme,
    isLoading,
    availableThemes: Object.keys(config.themes),
  }
}

export default useTheme


