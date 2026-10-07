// Single place that knows where tokens live.
// Default: localStorage (survives reloads, shared across tabs).
// Safer alternative: keep the refresh token in an httpOnly cookie set by your backend
// and only hold the access token in memory — then replace the functions below.
const ACCESS_KEY = 'eatspace.accessToken'
const REFRESH_KEY = 'eatspace.refreshToken'

export const TOKEN_KEYS = { ACCESS_KEY, REFRESH_KEY }

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken)
    // Refresh-token rotation: only overwrite when the server sends a new one
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}
