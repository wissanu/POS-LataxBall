import { http, bareHttp } from './http'

// Expected backend contract (see README):
//   POST /auth/login     { identifier, pin }          -> { accessToken, refreshToken, user }
//   POST /auth/register  { ...form }                  -> { accessToken, refreshToken, user }
//   POST /auth/refresh   { refreshToken }             -> { accessToken, refreshToken? }
//   POST /auth/logout    { refreshToken }             -> 204
//   GET  /auth/me                                     -> user
export const authService = {
  login: (payload) => bareHttp.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => bareHttp.post('/auth/register', payload).then((r) => r.data),
  logout: (refreshToken) => http.post('/auth/logout', { refreshToken }, { skipAuthRefresh: true }),
  me: () => http.get('/auth/me').then((r) => r.data),
}
