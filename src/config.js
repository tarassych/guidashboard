/**
 * Frontend Configuration
 * 
 * ============================================================================
 * ENVIRONMENT VARIABLES (set in .env or .env.local):
 * ============================================================================
 * 
 * VITE_API_URL
 *   API server URL. Leave empty for production (uses relative URL to same host)
 *   Example: 'http://localhost:3001' for local development
 * 
 * VITE_DEFAULT_THEME  
 *   Default theme to load on startup
 *   Available: 'digital-green', 'aggressive-red'
 *   Default: 'aggressive-red'
 * 
 * ============================================================================
 * Example .env file:
 * ============================================================================
 *   VITE_API_URL=
 *   VITE_DEFAULT_THEME=aggressive-red
 * ============================================================================
 */

export const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  
  // Theme Configuration - change default here or via VITE_DEFAULT_THEME env var
  defaultTheme: import.meta.env.VITE_DEFAULT_THEME || 'aggressive-red',
  
  // Available themes (add new themes here)
  themes: {
    'digital-green': () => import('./themes/digital-green.css'),
    'aggressive-red': () => import('./themes/aggressive-red.css'),
  },
  
  // Telemetry-based theme triggers
  // Theme will auto-switch when telemetry data matches conditions
  // Conditions are checked in order - first match wins
  themeConditions: {
    // Switch to aggressive-red when battery voltage drops below 35V
    lowBattery: {
      theme: 'aggressive-red',
      condition: (telemetry) => telemetry?.batt_v < 35,
    },
    // Switch to digital-green when in AUTO mode
    autoMode: {
      theme: 'digital-green', 
      condition: (telemetry) => telemetry?.md_str === 'AUTO',
    },
    // Add more conditions as needed:
    // manualMode: {
    //   theme: 'aggressive-red',
    //   condition: (telemetry) => telemetry?.md_str === 'MANUAL',
    // },
  },
}

export default config

