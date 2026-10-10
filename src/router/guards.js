import { useAuthStore } from '@/stores/auth'

/** first screen the user is allowed to open (used after sign-in and when a page is forbidden) */
const HOME_ORDER = [
  ['new-order', 'purchase.create'],
  ['orders', 'purchase.read'],
  ['reports', 'report.view'],
  ['system', 'user.manage'],
]
export function homeRouteFor(auth) {
  const hit = HOME_ORDER.find(([, perm]) => auth.can(perm))
  return hit ? { name: hit[0] } : { name: 'no-access' }
}

/**
 * JWT middleware for vue-router (runs before every navigation).
 *
 *  meta.requiresAuth  -> needs a valid session; silently refreshes an expired access token first
 *  meta.guestOnly     -> login; signed-in users are bounced to the app
 *  meta.permission    -> permission code (or list: any one is enough) the user must hold, e.g. 'report.view'
 */
export function registerAuthGuard(router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (to.meta.guestOnly) {
      if (!auth.hasSession) return true
      if (!auth.user) { try { await auth.fetchUser() } catch { auth.clearSession(); return true } }
      return homeRouteFor(auth)
    }
    if (!to.meta.requiresAuth) return true

    const toLogin = (reason) => ({
      name: 'login',
      query: { redirect: to.fullPath, ...(reason ? { reason } : {}) },
    })

    // 1. no refresh token (or it expired) -> must sign in again
    if (!auth.hasSession) {
      auth.clearSession()
      return toLogin('expired')
    }

    // 2. access token missing/expiring -> refresh it before the page loads
    try {
      await auth.ensureFreshToken()
    } catch (e) {
      auth.clearSession()
      return toLogin('expired')
    }

    // 3. first load after refresh/reopen: restore the user profile
    if (!auth.user) {
      try {
        await auth.fetchUser()
      } catch (e) {
        auth.clearSession()
        return toLogin()
      }
    }

    // 4. permission check
    const need = to.meta.permission
    if (need && !(Array.isArray(need) ? auth.canAny(...need) : auth.can(need))) {
      return homeRouteFor(auth)
    }
    return true
  })
}
