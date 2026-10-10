import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '@/services/authService'
import { refreshTokens } from '@/services/http'
import { tokenStorage } from '@/utils/token'
import { isTokenExpired } from '@/utils/jwt'

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

  function applySession({ accessToken, refreshToken, user: u }) {
    tokenStorage.set({ accessToken, refreshToken })
    if (u) user.value = u
    tick.value++
  }

  function clearSession() {
    tokenStorage.clear()
    try { localStorage.removeItem(AVATAR_KEY) } catch { /* ignore */ }
    user.value = null
    tick.value++
  }

  async function login(credentials) {
    loading.value = true
    try {
      applySession(await authService.login(credentials))
      avatar.value = pickAvatar() // new random colour for this session
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const refreshToken = tokenStorage.getRefresh()
    try {
      if (refreshToken) await authService.logout(refreshToken) // revoke server-side; ignore failures
    } catch { /* offline or already revoked */ }
    clearSession()
  }

  /** Called by the router guard when the access token is missing/expiring. */
  async function ensureFreshToken() {
    if (!isTokenExpired(tokenStorage.getAccess(), 30)) return
    await refreshTokens()
    tick.value++
  }

  async function fetchUser() {
    user.value = await authService.me()
  }

  return { user, avatar, loading, hasSession, isAuthenticated, role, permissions, can, canAny, login, logout, clearSession, ensureFreshToken, fetchUser }
})
