const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })
export const formatMoney = (n) => money.format(Number(n) || 0)

const two = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatNumber = (n) => two.format(Number(n) || 0)
export const formatKg = (n) => `${formatNumber(n)} กก.`

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')

/** "12.5" / "" / "abc" -> number (never NaN) */
export const toNumber = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** round to 2 decimals without floating-point drift (0.1 + 0.2 → 0.3) */
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** keep only digits and one decimal point, with at most `max` decimals — for money/weight inputs */
export const sanitizeDecimal = (v, max = 2) => {
  let s = String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')
  const i = s.indexOf('.')
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, max)
  return s
}

/**
 * For searching Thai/English text: NFC-normalise, lowercase, and ignore Thai tone marks
 * (่ ้ ๊ ๋ ์) so "สมชาย" still matches when the cashier skips a mark.
 */
export const normalizeSearch = (s) =>
  String(s ?? '').normalize('NFC').toLowerCase().replace(/[\u0E48-\u0E4C]/g, '').trim()
