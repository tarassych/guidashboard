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
 *   Default: 'digital-green'
 * 
 * VITE_GOOGLE_MAPS_API_KEY
 *   Google Maps API key for satellite map view
 *   Get your key from: https://console.cloud.google.com/google/maps-apis
 * 
 * ============================================================================
 * Example .env file:
 * ============================================================================
 *   VITE_API_URL=
 *   VITE_DEFAULT_THEME=digital-green
 *   VITE_GOOGLE_MAPS_API_KEY=your-api-key-here
 * ============================================================================
 */

export const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  
  // Theme Configuration - change default here or via VITE_DEFAULT_THEME env var
  defaultTheme: import.meta.env.VITE_DEFAULT_THEME || 'digital-green',
  
  // Google Maps API Key
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  
  // Available themes (add new themes here)
  themes: {
    'digital-green': () => import('./themes/digital-green.css'),
    'aggressive-red': () => import('./themes/aggressive-red.css'),
  },
  
  // Telemetry-based theme triggers
  // Theme will auto-switch when telemetry data matches conditions
  // Conditions are checked in order - first match wins
  themeConditions: {
    // Switch to aggressive-red when both fuses are armed (ground drones only)
    fusesArmed: {
      theme: 'aggressive-red',
      condition: (telemetry) => telemetry?.f1 === true && telemetry?.f2 === true,
    },
    // Switch to aggressive-red when battery voltage drops below 12V
    // Only trigger when we have valid battery data (> 1V) to avoid false triggers
    // batt_v = 0 means no data, so ignore it
    lowBattery: {
      theme: 'aggressive-red',
      condition: (telemetry) => telemetry?.batt_v > 1 && telemetry?.batt_v < 12,
    },
  },
}

export default config

