import { http, bareHttp } from './http'

// Backend contract (see README):
//   POST /auth/login       { username, password }   -> { accessToken, refreshToken, user }
//   POST /auth/refresh     { refreshToken }         -> { accessToken, refreshToken }   (refresh tokens are single-use: always store the new one)
//   POST /auth/logout      { refreshToken }         -> 204  (revokes that session at once; works even if the access token has expired)
//   POST /auth/logout-all                           -> { revoked }  (every device)
//   GET  /auth/me                                   -> user  (includes `role` and the effective `permissions[]`)
export const authService = {
  login: (payload) => bareHttp.post('/auth/login', payload).then((r) => r.data),
  // bareHttp on purpose: logout must work with an expired access token and must never trigger a refresh
  logout: (refreshToken) => bareHttp.post('/auth/logout', { refreshToken }, { timeout: 5000 }),
  logoutAll: () => http.post('/auth/logout-all', null, { skipAuthRefresh: true }).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
}
