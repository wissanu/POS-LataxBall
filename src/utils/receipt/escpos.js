import { RECEIPT } from '@/config/receipt'

/**
 * แปลงภาพใบเสร็จ (canvas) เป็นคำสั่ง ESC/POS แบบ raster (GS v 0)
 * ส่งเป็นภาพ จึงพิมพ์ภาษาไทยได้ตรงกับพรีวิวโดยไม่ต้องตั้ง code page ของเครื่อง
 * แบ่งภาพเป็นแถบ (band) แถบละไม่เกิน 128 แถว เพื่อไม่ให้บัฟเฟอร์ของเครื่องพิมพ์ล้น
 */
const ESC = 0x1b
const GS = 0x1d

export function canvasToEscPos(canvas, { cut = true, feedLines = 3, band = 128, threshold = RECEIPT.threshold } = {}) {
  const w = canvas.width
  const h = canvas.height
  const { data } = canvas.getContext('2d').getImageData(0, 0, w, h)
  const rowBytes = Math.ceil(w / 8)

  const chunks = [Uint8Array.of(ESC, 0x40)] // ESC @ : รีเซ็ตเครื่อง
  for (let y0 = 0; y0 < h; y0 += band) {
    const rows = Math.min(band, h - y0)
    const out = new Uint8Array(8 + rowBytes * rows)
    out.set([GS, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, rows & 0xff, rows >> 8]) // GS v 0 m xL xH yL yH
    for (let r = 0; r < rows; r++) {
      for (let x = 0; x < w; x++) {
        const i = ((y0 + r) * w + x) * 4
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        if (luma < threshold) out[8 + r * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    chunks.push(out)
  }
  chunks.push(Uint8Array.of(ESC, 0x64, feedLines)) // ESC d n : เลื่อนกระดาษ n บรรทัด
  if (cut) chunks.push(Uint8Array.of(GS, 0x56, 0x42, 0x00)) // GS V B 0 : เลื่อนถึงตำแหน่งตัด แล้วตัดแบบเว้นหัวกระดาษ

  const total = chunks.reduce((s, c) => s + c.length, 0)
  const bytes = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { bytes.set(c, o); o += c.length }
  return bytes
}

export function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
