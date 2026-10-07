import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '@/services/authService'
import { refreshTokens } from '@/services/http'
import { tokenStorage } from '@/utils/token'
import { isTokenExpired } from '@/utils/jwt'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  // tokens live in storage; this counter just makes `hasSession` reactive when they change
  const tick = ref(0)

  const hasSession = computed(() => (tick.value, !!tokenStorage.getRefresh() && !isTokenExpired(tokenStorage.getRefresh())))
  const isAuthenticated = computed(() => hasSession.value && !!user.value)
  const role = computed(() => user.value?.role)

  function applySession({ accessToken, refreshToken, user: u }) {
    tokenStorage.set({ accessToken, refreshToken })
    if (u) user.value = u
    tick.value++
  }

  function clearSession() {
    tokenStorage.clear()
    user.value = null
    tick.value++
  }

  async function login(credentials) {
    loading.value = true
    try {
      applySession(await authService.login(credentials))
    } finally {
      loading.value = false
    }
  }

  async function register(payload) {
    loading.value = true
    try {
      applySession(await authService.register(payload))
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

  return { user, loading, hasSession, isAuthenticated, role, login, register, logout, clearSession, ensureFreshToken, fetchUser }
})
