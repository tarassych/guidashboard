/**
 * Shared authentication utilities
 * Used by Settings page and drone activation
 */

const AUTH_COOKIE_NAME = 'gui_auth'
const AUTH_COOKIE_MAX_AGE = 60 * 60 // 1 hour in seconds

/**
 * Check if user is authenticated (valid cookie exists)
 * @returns {boolean}
 */
export function isAuthenticated() {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === AUTH_COOKIE_NAME) {
      try {
        const data = JSON.parse(decodeURIComponent(value))
        // Check if not expired (timestamp + 1h > now)
        if (data.timestamp && Date.now() - data.timestamp < AUTH_COOKIE_MAX_AGE * 1000) {
          return true
        }
      } catch (e) {
        // Invalid cookie, ignore
      }
    }
  }
  return false
}

/**
 * Set authentication cookie (valid for 1 hour)
 */
export function setAuthCookie() {
  const data = { authenticated: true, timestamp: Date.now() }
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(data))}; max-age=${AUTH_COOKIE_MAX_AGE}; path=/; SameSite=Strict`
}

/**
 * Clear authentication cookie (logout)
 */
export function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE_NAME}=; max-age=0; path=/`
}
