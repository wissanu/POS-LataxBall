import { RECEIPT } from '@/config/receipt'

/**
 * วาดใบเสร็จลงบน <canvas> กว้าง = RECEIPT.widthDots จุด (1 พิกเซล = 1 จุดของเครื่องพิมพ์)
 * ใช้ภาพเดียวกันทั้ง "พรีวิว" และ "พิมพ์" → สิ่งที่เห็นในพรีวิวคือสิ่งที่ออกมาจริง
 * และไม่ต้องพึ่ง code page ภาษาไทยของเครื่องพิมพ์ (ส่งเป็นภาพ raster)
 */
const W = RECEIPT.widthDots
const PAD = 10
const INNER = W - PAD * 2
const INK = '#000'
// เว้นว่างด้านบนเท่าความสูงบรรทัดชื่อร้าน (34px x 1.45) กันหัวใบเสร็จชิดขอบ/โดนใบมีดตัดของเครื่อง
const TOP_GAP = Math.round(34 * 1.45)

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n) => nf.format(Number(n) || 0)
const stampFmt = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})
const stamp = (d) => stampFmt.format(d instanceof Date ? d : new Date(d))

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'word' }) : null

const fontOf = (size, weight = 500) => `${weight} ${size}px ${RECEIPT.font}`

/** ตัดบรรทัดตามความกว้าง — ภาษาไทยไม่มีเว้นวรรค จึงใช้ Intl.Segmenter ตัดตามคำ (ไม่มีก็ตัดทีละตัวอักษร) */
function wrap(ctx, text, maxW) {
  const t = String(text ?? '')
  if (!t) return ['']
  const pieces = segmenter ? [...segmenter.segment(t)].map((s) => s.segment) : Array.from(t)
  const parts = pieces.flatMap((p) => (ctx.measureText(p).width > maxW ? Array.from(p) : [p])) // คำเดียวยาวเกินบรรทัด → ตัดทีละตัวอักษร
  const lines = []
  let cur = ''
  for (const p of parts) {
    if (!cur || ctx.measureText(cur + p).width <= maxW) cur += p
    else { lines.push(cur.trimEnd()); cur = p.trimStart() }
  }
  lines.push(cur.trimEnd())
  return lines
}

/** รายการสิ่งที่จะวาด (ยังไม่วาด) — แยกจากการวาดเพื่อให้รู้ความสูงรวมก่อนสร้าง canvas */
function build(order, { copy, printedAt }) {
  const ops = []
  const center = (text, size, weight = 600, gap = 4) => ops.push({ k: 'text', text, size, weight, align: 'center', gap })
  const row = (left, right, size = 22, weight = 500, gap = 4) => ops.push({ k: 'row', left, right, size, weight, gap })
  const sub = (text, size = 19) => ops.push({ k: 'text', text, size, weight: 500, align: 'left', indent: 22, gap: 2 })
  const rule = (style = 'dash') => ops.push({ k: 'rule', style })
  const space = (h) => ops.push({ k: 'space', h })

  center(RECEIPT.shopName, 34, 700, 6)
  RECEIPT.addressLines.forEach((l) => center(l, 19, 500, 2))
  if (RECEIPT.phone) center(`โทร ${RECEIPT.phone}`, 19, 500, 2)
  space(6)
  center(RECEIPT.title, 25, 700, 4)
  if (copy) center('*** สำเนา ***', 21, 700, 2)
  rule()

  row('เลขที่', order.no)
  row('วันที่', stamp(order.createdAt))
  const c = order.customer || {}
  row('ลูกค้า', `${c.name || '-'}${c.memberNo ? ` (${c.memberNo})` : ''}`)
  if (order.cashier) row('ผู้รับซื้อ', order.cashier)
  rule()

  row('รายการ', 'จำนวนเงิน', 21, 700, 2)
  rule('solid')

  const items = order.items || []
  items.forEach((it, i) => {
    const container = String(it.description || '').split('·')[0].trim()
    row(`${i + 1}. ${it.name}${container ? ` ${container}` : ''}`, num(it.price), 23, 700, 2)
    if (it.grossWeight != null && it.tare != null) sub(`ชั่งรวม ${num(it.grossWeight)}  หักภาชนะ ${num(it.tare)} กก.`)
    sub(`สุทธิ ${num(it.netWeight)} กก. × ${num(it.pricePerKg)} บาท/กก.`)
    space(5)
  })
  rule()

  const totalNet = items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0)
  const subtotal = Number(order.subtotal) || items.reduce((s, it) => s + (Number(it.price) || 0), 0)
  row('น้ำหนักสุทธิรวม', `${num(totalNet)} กก.`)
  row('รวมเป็นเงิน', num(subtotal))
  ;(order.adjustments || []).forEach((a) => row(a.reason || (a.type === 'ADD' ? 'เพิ่มราคา' : 'หักเงิน'), `${a.type === 'ADD' ? '+' : '-'}${num(a.amount)}`, 20, 500, 3))
  rule('solid')
  ops.push({ k: 'row', left: 'ยอดสุทธิ', right: `${num(order.total)}`, size: 34, weight: 700, rightSize: 40, gap: 2 })
  center('บาท', 20, 500, 2)
  rule()
  space(4)
  center(RECEIPT.footer, 23, 700, 6)
  center(`พิมพ์เมื่อ ${stamp(printedAt)}`, 17, 500, 2)
  space(24)
  return ops
}

async function ensureFonts() {
  if (!document.fonts?.load) return
  try {
    await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 22px 'Mali'`, 'ก ข ค 0123456789')))
  } catch { /* ใช้ฟอนต์สำรองแทน */ }
}

/**
 * @param {object} order  ใบรับซื้อจาก GET /orders (items, adjustments, total, customer, cashier, no, createdAt)
 * @param {{ copy?: boolean }} [opts] copy = พิมพ์ซ้ำ (ใส่ "*** สำเนา ***")
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderReceipt(order, { copy = false } = {}) {
  await ensureFonts()
  const ops = build(order, { copy, printedAt: new Date() })

  // ผ่านที่ 1: วัดความสูง
  const probe = document.createElement('canvas').getContext('2d')
  const placed = []
  let y = 6 + TOP_GAP
  for (const op of ops) {
    if (op.k === 'space') { y += op.h; continue }
    if (op.k === 'rule') { placed.push({ ...op, y: y + 6 }); y += 14; continue }
    const lh = (s) => Math.round(s * 1.45)
    if (op.k === 'text') {
      probe.font = fontOf(op.size, op.weight)
      const lines = wrap(probe, op.text, INNER - (op.indent || 0))
      placed.push({ ...op, lines, y, lh: lh(op.size) })
      y += lines.length * lh(op.size) + op.gap
    } else {
      const rs = op.rightSize || op.size
      probe.font = fontOf(rs, op.weight)
      const rw = Math.ceil(probe.measureText(op.right).width)
      probe.font = fontOf(op.size, op.weight)
      const lines = wrap(probe, op.left, Math.max(80, INNER - rw - 14))
      const h = Math.max(lines.length * lh(op.size), lh(rs))
      placed.push({ ...op, lines, rw, rs, y, lh: lh(op.size), h })
      y += h + op.gap
    }
  }

  // ผ่านที่ 2: วาดจริง
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.ceil(y)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, canvas.height)
  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  ctx.textBaseline = 'top'

  for (const p of placed) {
    if (p.k === 'rule') {
      ctx.lineWidth = p.style === 'solid' ? 2 : 1.5
      ctx.setLineDash(p.style === 'solid' ? [] : [6, 5])
      ctx.beginPath(); ctx.moveTo(PAD, p.y); ctx.lineTo(W - PAD, p.y); ctx.stroke()
      continue
    }
    ctx.font = fontOf(p.size, p.weight)
    if (p.k === 'text') {
      ctx.textAlign = p.align === 'center' ? 'center' : 'left'
      const x = p.align === 'center' ? W / 2 : PAD + (p.indent || 0)
      p.lines.forEach((l, i) => ctx.fillText(l, x, p.y + i * p.lh))
    } else {
      ctx.textAlign = 'left'
      p.lines.forEach((l, i) => ctx.fillText(l, PAD, p.y + i * p.lh))
      ctx.textAlign = 'right'
      ctx.font = fontOf(p.rs, p.weight)
      ctx.fillText(p.right, W - PAD, p.y)
    }
  }
  return canvas
}
