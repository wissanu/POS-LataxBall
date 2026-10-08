// A tiny fake backend so the UI runs without a server (VITE_USE_MOCK=true).
// It issues real JWT-shaped tokens and enforces expiry, so the refresh flow is genuinely exercised.
// Delete this folder (and the import in http.js) once your real API is ready.
import { AxiosError } from 'axios'
import { decodeJwt, isTokenExpired } from '@/utils/jwt'
import { users, products, categories, members, orders, queueOf, saveProducts } from './db'

const ACCESS_TTL = 60 // seconds — short on purpose so you can watch the refresh happen
const REFRESH_TTL = 60 * 60 * 24 * 7

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const sign = (payload, ttl) => {
  const now = Math.floor(Date.now() / 1000)
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload, iat: now, exp: now + ttl })}.mock-signature`
}
const issueTokens = (user) => ({
  accessToken: sign({ sub: user.id, role: user.role, type: 'access' }, ACCESS_TTL),
  refreshToken: sign({ sub: user.id, type: 'refresh' }, REFRESH_TTL),
})
const publicUser = ({ pin, ...rest }) => rest

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function requireAuth(config) {
  const token = (config.headers?.Authorization || config.headers?.get?.('Authorization') || '').replace('Bearer ', '')
  if (!token || isTokenExpired(token)) throw new HttpError(401, 'Access token expired or missing')
  const payload = decodeJwt(token)
  const user = users.find((u) => u.id === payload.sub)
  if (!user) throw new HttpError(401, 'Unknown user')
  return user
}

const routes = [
  ['POST', /^\/auth\/login$/, ({ body }) => {
    const id = String(body.identifier || '').trim().toLowerCase()
    const user = users.find((u) => u.cashierId.toLowerCase() === id || u.email.toLowerCase() === id)
    if (!user || user.pin !== String(body.pin)) throw new HttpError(401, 'Invalid cashier ID or PIN')
    return { ...issueTokens(user), user: publicUser(user) }
  }],
  ['POST', /^\/auth\/register$/, ({ body }) => {
    if (users.some((u) => u.email.toLowerCase() === String(body.email).toLowerCase()))
      throw new HttpError(409, 'An account with this email already exists')
    const user = {
      id: users.length + 1, cashierId: `CASHIER-${800 + users.length}`, name: body.fullName, email: body.email,
      pin: String(body.pin), role: 'manager', title: 'Store Manager', store: body.storeName, terminal: body.terminalId,
    }
    users.push(user)
    return { ...issueTokens(user), user: publicUser(user) }
  }],
  ['POST', /^\/auth\/refresh$/, ({ body }) => {
    const payload = body.refreshToken ? decodeJwt(body.refreshToken) : null
    if (!payload || payload.type !== 'refresh' || isTokenExpired(body.refreshToken))
      throw new HttpError(401, 'Refresh token is invalid or expired')
    const user = users.find((u) => u.id === payload.sub)
    if (!user) throw new HttpError(401, 'Unknown user')
    return issueTokens(user) // rotation: a new refresh token every time
  }],
  ['POST', /^\/auth\/logout$/, () => ({ ok: true })],
  ['GET', /^\/auth\/me$/, ({ config }) => publicUser(requireAuth(config))],

  ['GET', /^\/categories$/, ({ config }) => { requireAuth(config); return categories }],
  ['GET', /^\/members$/, ({ config }) => { requireAuth(config); return members }],
  ['GET', /^\/products$/, ({ config, query }) => {
    requireAuth(config)
    const q = String(query.search || '').toLowerCase()
    return products.filter((p) => !q || p.name.toLowerCase().includes(q))
  }],
  ['POST', /^\/products$/, ({ config, body }) => {
    requireAuth(config)
    const name = String(body.name || '').trim()
    const price = Number(body.price)
    if (!name) throw new HttpError(422, 'กรุณากรอกชื่อรายการ')
    if (!(price > 0)) throw new HttpError(422, 'ราคาต้องมากกว่า 0')
    const product = { id: Math.max(0, ...products.map((p) => p.id)) + 1, name, price: Math.round(price * 100) / 100 }
    products.push(product)
    saveProducts()
    return product
  }],

  ['GET', /^\/orders$/, ({ config }) => { requireAuth(config); return { data: orders, queue: queueOf(orders) } }],
  ['POST', /^\/orders$/, ({ config, body }) => {
    const user = requireAuth(config)
    const order = {
      id: Math.max(...orders.map((o) => o.id)) + 1,
      createdAt: new Date().toISOString(),
      customer: { name: body.customer?.name || 'ลูกค้าทั่วไป', type: body.customer?.type, memberNo: body.customer?.memberNo },
      cashier: user.name,
      // each line = one weighing (same product/container can appear many times)
      items: body.items.map((i) => ({
        id: i.productId, name: i.name, description: `${i.containerLabel} · ${Number(i.pricePerKg).toFixed(2)} บาท/กก.`,
        price: i.amount, qty: 1, netWeight: i.netWeight, grossWeight: i.gross, tare: i.tare, pricePerKg: i.pricePerKg,
      })),
      extraItems: 0,
      subtotal: body.subtotal, discount: body.discount,
      total: body.total,
      status: body.status === 'draft' ? 'draft' : 'pending',
    }
    orders.unshift(order)
    return order
  }],
  ['PATCH', /^\/orders\/(\d+)$/, ({ config, body, match }) => {
    requireAuth(config)
    const order = orders.find((o) => o.id === Number(match[1]))
    if (!order) throw new HttpError(404, 'Order not found')
    order.status = body.status
    return order
  }],
]

export async function mockAdapter(config) {
  await new Promise((r) => setTimeout(r, 250)) // fake latency
  const url = (config.url || '').split('?')[0]
  const method = (config.method || 'get').toUpperCase()
  let status = 200
  let data
  try {
    const route = routes.find(([m, re]) => m === method && re.test(url))
    if (!route) throw new HttpError(404, `No mock for ${method} ${url}`)
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
    data = JSON.parse(JSON.stringify(route[2]({ config, body, query: config.params || {}, match: url.match(route[1]) })))
  } catch (e) {
    if (!(e instanceof HttpError)) throw e
    status = e.status
    data = { message: e.message }
  }
  const response = { data, status, statusText: String(status), headers: {}, config, request: {} }
  if (status >= 200 && status < 300) return response
  throw new AxiosError(data.message, status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, response.request, response)
}
