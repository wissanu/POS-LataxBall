import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '@/services/authService'
import { refreshTokens, notifyAuthFailure } from '@/services/http'
import { tokenStorage } from '@/utils/token'
import { isTokenExpired } from '@/utils/jwt'

const LOGIN_HREF = `${import.meta.env.BASE_URL}login`

// random avatar colours (background / text) — one is picked at every sign-in and kept until sign-out
const AVATAR_KEY = 'eatspace.avatar'
const PALETTE = [
  { bg: '#fecdd3', fg: '#9f1239' }, { bg: '#c7d2fe', fg: '#3730a3' }, { bg: '#92400e', fg: '#ffffff' },
  { bg: '#a7f3d0', fg: '#065f46' }, { bg: '#bae6fd', fg: '#075985' }, { bg: '#ddd6fe', fg: '#5b21b6' },
  { bg: '#fed7aa', fg: '#9a3412' }, { bg: '#99f6e4', fg: '#115e59' }, { bg: '#334155', fg: '#ffffff' },
  { bg: '#f5d0fe', fg: '#86198f' }, { bg: '#047857', fg: '#ffffff' }, { bg: '#1d4ed8', fg: '#ffffff' },
]
function pickAvatar() {
  const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
  try { localStorage.setItem(AVATAR_KEY, JSON.stringify(c)) } catch { /* ignore */ }
  return c
}
function readAvatar() {
  try {
    const c = JSON.parse(localStorage.getItem(AVATAR_KEY))
    if (c?.bg && c?.fg) return c
  } catch { /* ignore */ }
  return pickAvatar()
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const avatar = ref(readAvatar())
  const loading = ref(false)
  // tokens live in storage; this counter just makes `hasSession` reactive when they change
  const tick = ref(0)

  const hasSession = computed(() => (tick.value, !!tokenStorage.getRefresh() && !isTokenExpired(tokenStorage.getRefresh())))
  const isAuthenticated = computed(() => hasSession.value && !!user.value)
  const role = computed(() => user.value?.role)
  const permissions = computed(() => new Set(user.value?.permissions ?? []))
  /** true when the signed-in user holds ALL given permission codes */
  const can = (...codes) => codes.every((c) => permissions.value.has(c))
  /** true when the signed-in user holds AT LEAST ONE of the given permission codes */
  const canAny = (...codes) => codes.some((c) => permissions.value.has(c))

  // ---- proactive refresh: renew the access token ~60 s before it expires so users never hit a 401 mid-action ----
  let refreshTimer = null
  const stopRefreshTimer = () => { clearTimeout(refreshTimer); refreshTimer = null }
  function scheduleRefresh() {
    stopRefreshTimer()
    if (!tokenStorage.getRefresh()) return
    const delay = Math.min(Math.max(5, tokenStorage.accessTtl() - 60) * 1000, 2 ** 31 - 1)
    refreshTimer = setTimeout(renewNow, delay)
  }
  async function renewNow() {
    if (!tokenStorage.getRefresh()) return
    try {
      await refreshTokens()
      tick.value++
      scheduleRefresh()
    } catch (e) {
      // 4xx = the server says the session is over; anything else (offline, 5xx) = try again shortly
      if (e?.response && e.response.status < 500) { tokenStorage.clear(); notifyAuthFailure() }
      else refreshTimer = setTimeout(renewNow, 15000)
    }
  }
  // a hidden tab's timers are throttled and a sleeping laptop skips them — re-check when the user comes back
  function onWake() {
    if (document.visibilityState === 'hidden' || !tokenStorage.getRefresh()) return
    if (tokenStorage.accessTtl() < 60) renewNow()
    else scheduleRefresh()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
  }

  function applySession({ accessToken, refreshToken, user: u }) {
    tokenStorage.set({ accessToken, refreshToken })
    if (u) user.value = u
    tick.value++
    scheduleRefresh()
  }

  function clearSession() {
    stopRefreshTimer()
    tokenStorage.clear()
    try { localStorage.removeItem(AVATAR_KEY) } catch { /* ignore */ }
    user.value = null
    tick.value++
  }

  async function login(credentials) {
    loading.value = true
    // a leftover session on this browser (e.g. the tab was closed without signing out): end it on the server first
    const leftover = tokenStorage.getRefresh()
    if (leftover) authService.logout(leftover).catch(() => {})
    try {
      applySession(await authService.login(credentials))
      avatar.value = pickAvatar() // new random colour for this session
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign out: revoke the session on the server (the access token stops working at once), wipe the tokens, then reload
   * the login page. The reload is deliberate — it clears every in-memory store (cart, orders, prices…) and stops all
   * timers/polling, so nothing from this user can leak to the next person at the counter.
   */
  async function logout({ redirect = true } = {}) {
    const refreshToken = tokenStorage.getRefresh()
    stopRefreshTimer()
    try {
      if (refreshToken) await authService.logout(refreshToken)
    } catch { /* offline: the session still expires on its own; local tokens are removed below either way */ }
    clearSession()
    if (redirect) window.location.replace(LOGIN_HREF)
  }

  /** Called by the router guard when the access token is missing/expiring. */
  async function ensureFreshToken() {
    if (!tokenStorage.isAccessExpired(30)) return
    await refreshTokens()
    tick.value++
    scheduleRefresh()
  }

  async function fetchUser() {
    user.value = await authService.me()
    scheduleRefresh() // covers a page reload with an existing session
  }

  return { user, avatar, loading, hasSession, isAuthenticated, role, permissions, can, canAny, login, logout, clearSession, ensureFreshToken, fetchUser }
})
