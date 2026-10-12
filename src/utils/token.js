// Single place that knows where tokens live.
// Default: localStorage (survives reloads, shared across tabs).
// Safer for production: keep the refresh token in an httpOnly cookie set by the backend (not readable by
// JavaScript, so an XSS bug cannot steal it) and hold the access token in memory only — then replace the functions below.
import { decodeJwt } from './jwt'

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
  /** seconds until the access token expires (<= 0 when missing/expired) */
  accessTtl() {
    const exp = decodeJwt(localStorage.getItem(ACCESS_KEY) ?? '')?.exp
    return exp ? exp - Date.now() / 1000 : 0
  },
  isAccessExpired(skewSeconds = 0) {
    return this.accessTtl() <= skewSeconds
  },
}
