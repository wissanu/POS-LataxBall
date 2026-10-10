import { http, bareHttp } from './http'

// Expected backend contract (see README):
//   POST /auth/login     { username, password}        -> { accessToken, refreshToken, user }
//   POST /auth/refresh   { refreshToken }             -> { accessToken, refreshToken? }
//   POST /auth/logout    { refreshToken }             -> 204
//   GET  /auth/me                                     -> user  (includes `role` and the effective `permissions[]`)
export const authService = {
  login: (payload) => bareHttp.post('/auth/login', payload).then((r) => r.data),
  logout: (refreshToken) => http.post('/auth/logout', { refreshToken }, { skipAuthRefresh: true }),
  me: () => http.get('/auth/me').then((r) => r.data),
}
