// A tiny fake backend so the UI runs without a server (VITE_USE_MOCK=true).
// It issues real JWT-shaped tokens and enforces expiry, so the refresh flow is genuinely exercised.
// Delete this folder (and the import in http.js) once your real API is ready.
import { AxiosError } from 'axios'
import { decodeJwt, isTokenExpired } from '@/utils/jwt'
import { products, categories, members, orders, queueOf, saveProducts, getContainerDoc, saveContainerDoc } from './db'
import {
  PERMISSIONS, ROLES, users, saveUsers, rolePermissions, saveRolePermissions,
  effectivePermissions, roleOf, roleLabel,
} from './rbac'
import { salesOverview } from './sales'

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
const publicUser = ({ password, overrides, ...rest }) => ({
  ...rest,
  title: roleLabel(rest.role),
  permissions: effectivePermissions({ ...rest, overrides }),
})

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function requireAuth(config) {
  const token = (config.headers?.Authorization || config.headers?.get?.('Authorization') || '').replace('Bearer ', '')
  if (!token || isTokenExpired(token)) throw new HttpError(401, 'Access token expired or missing')
  const payload = decodeJwt(token)
  const user = users.find((u) => u.id === payload.sub)
  if (!user || !user.active) throw new HttpError(401, 'Unknown or disabled user')
  return user
}

/** same idea as the real API's permission guard: 403 when the signed-in user lacks the permission */
function requirePerm(config, ...codes) {
  const user = requireAuth(config)
  const have = effectivePermissions(user)
  if (!codes.some((c) => have.includes(c))) throw new HttpError(403, 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้')
  return user
}

const activeAdmins = () => users.filter((u) => u.role === 'ADMIN' && u.active)
const LAST_ADMIN = 'ต้องมี ADMIN ที่ใช้งานอยู่อย่างน้อย 1 คน'
const adminView = ({ password, ...u }) => ({ ...u, permissions: effectivePermissions(u) })

function validateUserFields(body, { existing } = {}) {
  const out = {}
  if (!existing) {
    const username = String(body.username || '').trim()
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) throw new HttpError(422, 'ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–30 ตัว (ใช้ . _ - ได้)')
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, 'ชื่อผู้ใช้นี้ถูกใช้แล้ว')
    out.username = username
  }
  const name = String(body.name ?? existing?.name ?? '').trim()
  if (!name) throw new HttpError(422, 'กรุณากรอกชื่อที่แสดง')
  out.name = name

  if (body.password !== undefined && body.password !== '') {
    if (String(body.password).length < 6) throw new HttpError(422, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    out.password = String(body.password)
  } else if (!existing) throw new HttpError(422, 'กรุณากรอกรหัสผ่าน')

  const role = body.role ?? existing?.role
  if (!roleOf(role)) throw new HttpError(422, 'บทบาทไม่ถูกต้อง')
  out.role = role
  if (roleOf(role).isStaff) out.customerId = null
  else {
    const customerId = Number(body.customerId ?? existing?.customerId)
    if (!members.some((m) => m.id === customerId)) throw new HttpError(422, 'บัญชีลูกค้าต้องเลือกลูกค้าที่จะผูกด้วย')
    if (users.some((u) => u.customerId === customerId && u.id !== existing?.id)) throw new HttpError(409, 'ลูกค้ารายนี้มีบัญชีอยู่แล้ว')
    out.customerId = customerId
  }
  out.active = body.active === undefined ? existing?.active ?? true : !!body.active
  return out
}

const routes = [
  ['POST', /^\/auth\/login$/, ({ body }) => {
    const id = String(body.username || '').trim().toLowerCase()
    const user = users.find((u) => u.username.toLowerCase() === id)
    if (!user || user.password !== String(body.password)) throw new HttpError(401, 'Invalid username or password')
    if (!user.active) throw new HttpError(403, 'บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
    if (user.role === 'CUSTOMER') throw new HttpError(403, 'บัญชีลูกค้าใช้งานระบบหน้าร้านไม่ได้')
    user.lastLoginAt = new Date().toISOString()
    saveUsers()
    return { ...issueTokens(user), user: publicUser(user) }
  }],
  ['POST', /^\/auth\/refresh$/, ({ body }) => {
    const payload = body.refreshToken ? decodeJwt(body.refreshToken) : null
    if (!payload || payload.type !== 'refresh' || isTokenExpired(body.refreshToken))
      throw new HttpError(401, 'Refresh token is invalid or expired')
    const user = users.find((u) => u.id === payload.sub)
    if (!user || !user.active) throw new HttpError(401, 'Unknown or disabled user')
    return issueTokens(user) // rotation: a new refresh token every time
  }],
  ['POST', /^\/auth\/logout$/, () => ({ ok: true })],
  ['GET', /^\/auth\/me$/, ({ config }) => publicUser(requireAuth(config))],

  // ---- reports ----
  ['GET', /^\/reports\/overview$/, ({ config, query }) => {
    requirePerm(config, 'report.view')
    const res = salesOverview(query)
    if (res.error) throw new HttpError(422, res.error)
    return res
  }],

  // ---- admin: users / roles / permissions ----
  ['GET', /^\/admin\/permissions$/, ({ config }) => { requirePerm(config, 'user.manage', 'role.manage'); return PERMISSIONS }],
  ['GET', /^\/admin\/roles$/, ({ config }) => {
    requirePerm(config, 'user.manage', 'role.manage')
    return ROLES.map((r) => ({ ...r, permissions: [...rolePermissions[r.code]] }))
  }],
  ['PUT', /^\/admin\/roles\/([A-Z]+)\/permissions$/, ({ config, body, match }) => {
    requirePerm(config, 'role.manage')
    const role = roleOf(match[1])
    if (!role) throw new HttpError(404, 'ไม่พบบทบาท')
    if (role.code === 'ADMIN') throw new HttpError(422, 'ADMIN มีทุกสิทธิ์เสมอ แก้ไขไม่ได้')
    const codes = [...new Set(body.permissions)]
    if (!Array.isArray(body.permissions) || codes.some((c) => !PERMISSIONS.some((p) => p.code === c))) throw new HttpError(422, 'รายการสิทธิ์ไม่ถูกต้อง')
    rolePermissions[role.code] = PERMISSIONS.map((p) => p.code).filter((c) => codes.includes(c))
    saveRolePermissions()
    return { ...role, permissions: [...rolePermissions[role.code]] }
  }],
  ['GET', /^\/admin\/users$/, ({ config }) => { requirePerm(config, 'user.manage', 'user.read'); return users.map(adminView) }],
  ['POST', /^\/admin\/users$/, ({ config, body }) => {
    requirePerm(config, 'user.manage')
    const fields = validateUserFields(body)
    const user = { id: Math.max(0, ...users.map((x) => x.id)) + 1, overrides: {}, lastLoginAt: null, ...fields }
    users.push(user)
    saveUsers()
    return adminView(user)
  }],
  ['PATCH', /^\/admin\/users\/(\d+)$/, ({ config, body, match }) => {
    requirePerm(config, 'user.manage')
    const user = users.find((x) => x.id === Number(match[1]))
    if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้')
    const fields = validateUserFields(body, { existing: user })
    const staysAdmin = fields.role === 'ADMIN' && fields.active
    if (user.role === 'ADMIN' && user.active && !staysAdmin && activeAdmins().length <= 1) throw new HttpError(409, LAST_ADMIN)
    Object.assign(user, fields)
    saveUsers()
    return adminView(user)
  }],
  ['DELETE', /^\/admin\/users\/(\d+)$/, ({ config, match }) => {
    const me = requirePerm(config, 'user.manage')
    const user = users.find((x) => x.id === Number(match[1]))
    if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้')
    if (user.id === me.id) throw new HttpError(409, 'ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้')
    if (user.role === 'ADMIN' && user.active && activeAdmins().length <= 1) throw new HttpError(409, LAST_ADMIN)
    users.splice(users.indexOf(user), 1)
    saveUsers()
    return { ok: true }
  }],
  ['PUT', /^\/admin\/users\/(\d+)\/permissions$/, ({ config, body, match }) => {
    requirePerm(config, 'role.manage')
    const user = users.find((x) => x.id === Number(match[1]))
    if (!user) throw new HttpError(404, 'ไม่พบผู้ใช้')
    if (user.role === 'ADMIN') throw new HttpError(422, 'ADMIN มีทุกสิทธิ์เสมอ ปรับรายบุคคลไม่ได้')
    const base = new Set(rolePermissions[user.role])
    const next = {}
    for (const [code, effect] of Object.entries(body.overrides ?? {})) {
      if (!PERMISSIONS.some((p) => p.code === code) || !['GRANT', 'DENY'].includes(effect)) throw new HttpError(422, 'รายการสิทธิ์ไม่ถูกต้อง')
      // keep only real differences from the role defaults
      if ((effect === 'GRANT') !== base.has(code)) next[code] = effect
    }
    user.overrides = next
    saveUsers()
    return adminView(user)
  }],

  ['GET', /^\/categories$/, ({ config }) => { requireAuth(config); return categories }],
  ['GET', /^\/settings\/containers$/, ({ config }) => { requireAuth(config); return getContainerDoc() }],
  ['PUT', /^\/settings\/containers$/, ({ config, body }) => {
    requireAuth(config)
    if (!Array.isArray(body.containers)) throw new HttpError(422, 'รูปแบบข้อมูลไม่ถูกต้อง')
    const doc = getContainerDoc()
    const next = doc.containers.map((c) => ({ ...c }))
    for (const u of body.containers) {
      const target = next.find((c) => c.id === u.id)
      if (!target) throw new HttpError(422, `ไม่พบภาชนะรหัส “${u.id}” (เพิ่มหรือลบภาชนะไม่ได้)`)
      const tare = Number(u.tare)
      if (!Number.isFinite(tare) || tare < 0 || tare > 9999) throw new HttpError(422, 'น้ำหนักภาชนะต้องเป็นตัวเลข 0 – 9999')
      if (target.fixed && tare !== target.tare) throw new HttpError(422, `“${target.label}” แก้ไขค่าไม่ได้`)
      target.tare = Math.round(tare * 100) / 100
    }
    const saved = { ...doc, updatedAt: new Date().toISOString(), containers: next }
    saveContainerDoc(saved)
    return saved
  }],

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
      subtotal: body.subtotal, discounts: body.discounts ?? [], discountTotal: body.discountTotal ?? 0,
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
