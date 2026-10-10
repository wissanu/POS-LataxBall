// Mock sales data for GET /reports/overview.
// History = ~180 days of generated bills (stable per day) + real orders created in this browser session.
import { members, orders } from './db'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) } // noon: safe from DST
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// small seeded PRNG so the same day always produces the same bills
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GENERAL = { key: 'general', name: 'ลูกค้าทั่วไป' }
const GRADES = [['ก้อนถ้วย A+', 28, 0.15], ['ก้อนถ้วย A', 26, 0.3], ['ก้อนถ้วย B', 24, 0.3], ['ก้อนถ้วย C', 22, 0.15], ['ก้อนถ้วย D', 20, 0.1]]
const memberCustomer = (m) => ({ key: `m:${m.no}`, name: m.name })

let history = null
function buildHistory() {
  const out = []
  const today = new Date()
  for (let i = 179; i >= 0; i--) {
    const day = addDays(today, -i)
    const r = rng(Number(ymd(day).replaceAll('-', '')))
    const n = day.getDay() === 0 ? Math.floor(r() * 3) : 2 + Math.floor(r() * 7)
    for (let b = 0; b < n; b++) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8 + Math.floor(r() * 9), Math.floor(r() * 60))
      if (at > today) continue
      const pick = r()
      const customer = pick < 0.7 ? memberCustomer(members[Math.min(members.length - 1, Math.floor(r() * r() * members.length * 1.6))]) : GENERAL
      const lines = []
      const lineCount = 1 + Math.floor(r() * 2)
      for (let l = 0; l < lineCount; l++) {
        let x = r(); let g = GRADES[0]
        for (const cand of GRADES) { if (x < cand[2]) { g = cand; break } x -= cand[2] }
        const price = round2(g[1] + 1.5 * Math.sin(i / 9))
        const netKg = round2(40 + r() * 360)
        lines.push({ name: g[0], netKg, amount: round2(netKg * price) })
      }
      out.push({ date: ymd(at), at: at.toISOString(), customer, lines })
    }
  }
  return out
}

// orders created through POST /orders with the new weighing format (they have netWeight)
function liveBills() {
  return orders
    .filter((o) => ['pending', 'complete'].includes(o.status) && o.items?.[0]?.netWeight !== undefined)
    .map((o) => ({
      date: ymd(new Date(o.createdAt)),
      at: o.createdAt,
      customer: o.customer?.memberNo ? { key: `m:${o.customer.memberNo}`, name: o.customer.name } : GENERAL,
      // the order total already has discounts applied; spread it over the lines by weight share
      lines: (() => {
        const net = o.items.reduce((s, i) => s + i.netWeight, 0) || 1
        return o.items.map((i) => ({ name: i.name, netKg: i.netWeight, amount: round2((o.total * i.netWeight) / net) }))
      })(),
    }))
}

const withTotals = (b) => ({
  ...b,
  netKg: round2(b.lines.reduce((s, l) => s + l.netKg, 0)),
  total: round2(b.lines.reduce((s, l) => s + l.amount, 0)),
})
const allBills = () => ((history ??= buildHistory()), [...history, ...liveBills()].map(withTotals))

function bucketStart(dateStr, groupBy) {
  const d = parse(dateStr)
  if (groupBy === 'week') return ymd(addDays(d, -((d.getDay() + 6) % 7))) // Monday
  if (groupBy === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  return dateStr
}
function nextBucket(startStr, groupBy) {
  const d = parse(startStr)
  if (groupBy === 'week') return ymd(addDays(d, 7))
  if (groupBy === 'month') return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1, 12))
  return ymd(addDays(d, 1))
}

const sum = (list) => ({
  total: round2(list.reduce((s, b) => s + b.total, 0)),
  netKg: round2(list.reduce((s, b) => s + b.netKg, 0)),
  billCount: list.length,
})

/** @returns {{error:string}|object} */
export function salesOverview({ from, to, groupBy = 'day', customer } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) return { error: 'ช่วงวันที่ไม่ถูกต้อง' }
  if (from > to) return { error: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' }
  const days = Math.round((parse(to) - parse(from)) / 86400000) + 1
  if (days > 400) return { error: 'เลือกช่วงวันที่ได้ไม่เกิน 400 วัน' }
  if (!['day', 'week', 'month'].includes(groupBy)) return { error: 'groupBy ต้องเป็น day, week หรือ month' }

  const bills = allBills()
  const inRange = (a, b) => bills.filter((x) => x.date >= a && x.date <= b)
  const current = inRange(from, to)
  const scoped = customer ? current.filter((b) => b.customer.key === customer) : current

  // previous period of the same length (for the "vs previous" chip)
  const prevTo = ymd(addDays(parse(from), -1))
  const prevFrom = ymd(addDays(parse(prevTo), -(days - 1)))
  const prevList = inRange(prevFrom, prevTo)
  const previous = sum(customer ? prevList.filter((b) => b.customer.key === customer) : prevList)

  // series, with empty buckets filled in
  const map = new Map()
  for (let k = bucketStart(from, groupBy); k <= to; k = nextBucket(k, groupBy)) {
    map.set(k, { key: k, from: k < from ? from : k, total: 0, netKg: 0, bills: 0 })
  }
  for (const b of scoped) {
    const p = map.get(bucketStart(b.date, groupBy))
    p.total = round2(p.total + b.total); p.netKg = round2(p.netKg + b.netKg); p.bills += 1
  }

  const group = (list, keyOf, nameOf) => {
    const m = new Map()
    for (const x of list) {
      const k = keyOf(x)
      const e = m.get(k) ?? { key: k, name: nameOf(x), total: 0, netKg: 0, bills: 0 }
      e.total = round2(e.total + x.total); e.netKg = round2(e.netKg + x.netKg); e.bills += 1
      m.set(k, e)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }
  const lineRows = scoped.flatMap((b) => b.lines.map((l) => ({ ...l, total: l.amount, bills: 1 })))
  const byProductMap = new Map()
  for (const l of lineRows) {
    const e = byProductMap.get(l.name) ?? { key: l.name, name: l.name, total: 0, netKg: 0 }
    e.total = round2(e.total + l.amount); e.netKg = round2(e.netKg + l.netKg)
    byProductMap.set(l.name, e)
  }

  return {
    range: { from, to, groupBy, days },
    summary: { ...sum(scoped), previous },
    series: [...map.values()],
    byCustomer: group(current, (b) => b.customer.key, (b) => b.customer.name), // not narrowed by the customer filter
    byProduct: [...byProductMap.values()].sort((a, b) => b.total - a.total),
  }
}
