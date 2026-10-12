import axios from 'axios'
import { tokenStorage } from '@/utils/token'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
const config = { baseURL, timeout: 15000 }

/** Authenticated client: attaches the access token, refreshes it on 401. */
export const http = axios.create(config)

/** Client WITHOUT interceptors — used for login/refresh so they can never loop. */
export const bareHttp = axios.create(config)

// ---- Refresh handling -------------------------------------------------------
// Three layers keep concurrent refreshes from killing the session (refresh tokens are single-use):
//   1. one refresh per tab at a time (everyone in this tab awaits the same promise)
//   2. one refresh across ALL tabs at a time (Web Locks), and a tab that waited re-reads the tokens
//      first — if another tab already refreshed, it just uses the new ones
//   3. the server forgives a re-used previous token for a few seconds (REFRESH_LEEWAY_SECONDS)
let refreshPromise = null
let onAuthFailure = () => {}

/** The app registers what should happen when the session cannot be recovered. */
export const setAuthFailureHandler = (fn) => { onAuthFailure = fn }
export const notifyAuthFailure = () => onAuthFailure()

async function doRefresh(staleAccess) {
  // another tab (or request) may have refreshed while we waited for the lock
  const current = tokenStorage.getAccess()
  if (current && current !== staleAccess && !tokenStorage.isAccessExpired(10)) return current

  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) throw new Error('No refresh token')
  const { data } = await bareHttp.post('/auth/refresh', { refreshToken })
  tokenStorage.set(data)
  return data.accessToken
}

/** @param {string|null} staleAccess the access token that just failed (so we can tell if someone else already replaced it) */
export function refreshTokens(staleAccess = tokenStorage.getAccess()) {
  if (!refreshPromise) {
    const run = () => doRefresh(staleAccess)
    const locked = typeof navigator !== 'undefined' && navigator.locks?.request
      ? navigator.locks.request('eatspace-token-refresh', run)
      : run()
    refreshPromise = locked.finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// ---- Interceptors -----------------------------------------------------------
http.interceptors.request.use((req) => {
  const token = tokenStorage.getAccess()
  if (token) req.headers.Authorization = `Bearer ${token}`
  return req
})

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config: original } = error
    const canRetry = response?.status === 401 && original && !original._retried && !original.skipAuthRefresh
    if (!canRetry) return Promise.reject(error)

    original._retried = true
    const failedWith = (original.headers?.Authorization || '').replace(/^Bearer /, '') || null
    try {
      const newToken = await refreshTokens(failedWith)
      original.headers.Authorization = `Bearer ${newToken}`
      return http(original) // replay the original request once
    } catch (refreshError) {
      // only a real "your session is gone" answer ends the session; a network blip must not log everybody out
      const status = refreshError?.response?.status
      if (!refreshError?.response || status >= 500) return Promise.reject(error)
      tokenStorage.clear()
      onAuthFailure()
      return Promise.reject(refreshError)
    }
  },
)

/** Turn any axios error into a message that is safe to show in the UI */
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || (err?.code === 'ERR_NETWORK' ? 'Cannot reach the server.' : fallback)
