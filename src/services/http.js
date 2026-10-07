import axios from 'axios'
import { tokenStorage } from '@/utils/token'
import { mockAdapter } from './mock'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
const useMock = import.meta.env.VITE_USE_MOCK === 'true'
const config = { baseURL, timeout: 15000, ...(useMock ? { adapter: mockAdapter } : {}) }

/** Authenticated client: attaches the access token, refreshes it on 401. */
export const http = axios.create(config)

/** Client WITHOUT interceptors — used for login/register/refresh so they can never loop. */
export const bareHttp = axios.create(config)

// ---- Refresh handling -------------------------------------------------------
let refreshPromise = null // one refresh at a time, everyone else waits for it
let onAuthFailure = () => {}

/** The app registers what should happen when the session cannot be recovered. */
export const setAuthFailureHandler = (fn) => { onAuthFailure = fn }

export function refreshTokens() {
  if (!refreshPromise) {
    const refreshToken = tokenStorage.getRefresh()
    if (!refreshToken) return Promise.reject(new Error('No refresh token'))
    refreshPromise = bareHttp
      .post('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        tokenStorage.set(data)
        return data.accessToken
      })
      .finally(() => { refreshPromise = null })
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
    try {
      const newToken = await refreshTokens()
      original.headers.Authorization = `Bearer ${newToken}`
      return http(original) // replay the original request once
    } catch (refreshError) {
      tokenStorage.clear()
      onAuthFailure()
      return Promise.reject(refreshError)
    }
  },
)

/** Turn any axios error into a message that is safe to show in the UI */
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || (err?.code === 'ERR_NETWORK' ? 'Cannot reach the server.' : fallback)
