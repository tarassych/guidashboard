/**
 * Theme Management
 * 
 * Available themes:
 * - digital-green: Cyberpunk green HUD theme (default)
 * 
 * To add a new theme:
 * 1. Create a new CSS file in this directory (e.g., amber-military.css)
 * 2. Follow the variable naming convention from digital-green.css
 * 3. Add the theme to the exports below
 * 
 * To switch themes:
 * - Change the import in App.css from './themes/digital-green.css' to your theme
 * - Or dynamically load themes using the loadTheme function
 */

export const THEMES = {
  DIGITAL_GREEN: 'digital-green',
  AGGRESSIVE_RED: 'aggressive-red',
  // Add more themes here:
  // AMBER_MILITARY: 'amber-military',
  // CYBER_BLUE: 'cyber-blue',
};

export const DEFAULT_THEME = THEMES.DIGITAL_GREEN;

/**
 * Dynamically load a theme (for future theme switching feature)
 * @param {string} themeName - Name of the theme to load
 */
export const loadTheme = async (themeName) => {
  try {
    await import(`./${themeName}.css`);
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('selectedTheme', themeName);
    return true;
  } catch (error) {
    console.error(`Failed to load theme: ${themeName}`, error);
    return false;
  }
};

/**
 * Get the currently active theme
 */
export const getCurrentTheme = () => {
  return localStorage.getItem('selectedTheme') || DEFAULT_THEME;
};

