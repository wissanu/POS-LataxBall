import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/services/http'

/**
 * JWT middleware for vue-router (runs before every navigation).
 *
 *  meta.requiresAuth  -> needs a valid session; silently refreshes an expired access token first
 *  meta.guestOnly     -> login/register; signed-in users are bounced to the app
 *  meta.roles         -> optional role allow-list, e.g. ['manager']
 */
export function registerAuthGuard(router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (to.meta.guestOnly) {
      return auth.hasSession ? { name: 'new-order' } : true
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

    // 4. role check
    if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
      return { name: 'new-order' }
    }
    return true
  })
}
