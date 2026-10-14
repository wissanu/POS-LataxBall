import { http } from './http'
import { RECEIPT } from '@/config/receipt'
import { canvasToEscPos, toBase64 } from '@/utils/receipt/escpos'

/**
 * พิมพ์ใบเสร็จ — ไม่ใช้ QZ Tray มี 2 วิธี (เลือกได้ในหน้าต่างพรีวิว):
 *  - browser : พิมพ์ผ่านเบราว์เซอร์ → ไดรเวอร์เครื่องพิมพ์ของระบบปฏิบัติการ (ใช้ได้กับทุกเครื่อง/ทุกพอร์ต)
 *  - escpos  : ส่งคำสั่ง ESC/POS ไปที่ API (POST /print/raw) แล้ว API ส่งต่อเครื่องพิมพ์ผ่าน LAN:9100 / CUPS / ไฟล์อุปกรณ์
 *              (ตั้งค่า PRINTER_* ในไฟล์ .env ของ rubber-pos-api) → ไม่มีหน้าต่างถามทุกครั้ง
 */
export const PRINT_DRIVERS = [
  { id: 'browser', label: 'ผ่านเบราว์เซอร์' },
  { id: 'escpos', label: 'พิมพ์ตรง (ESC/POS)' },
]
const KEY = 'pos.printDriver'

export function getDriver() {
  try {
    const v = localStorage.getItem(KEY)
    if (PRINT_DRIVERS.some((d) => d.id === v)) return v
  } catch { /* ใช้ค่าเริ่มต้น */ }
  return import.meta.env.VITE_PRINT_DRIVER === 'escpos' ? 'escpos' : 'browser'
}
export function setDriver(id) {
  try { localStorage.setItem(KEY, id) } catch { /* ไม่เป็นไร */ }
}

async function printViaApi(canvas) {
  await http.post('/print/raw', { data: toBase64(canvasToEscPos(canvas)) }, { timeout: 20000 })
}

/** เปิดหน้าต่างพิมพ์ของเบราว์เซอร์ด้วยภาพใบเสร็จ (กระดาษกว้าง 80 มม. ไม่มีขอบ) — คืนค่าเมื่อหน้าต่างพิมพ์ปิดลง */
function printViaBrowser(canvas) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      @page { size: ${RECEIPT.paperMm}mm auto; margin: 0 }
      html, body { margin: 0; padding: 0; background: #fff }
      img { display: block; width: ${RECEIPT.printMm}mm; margin: 0 auto }
    </style></head><body></body></html>`)
    doc.close()
    const win = iframe.contentWindow
    const remove = () => iframe.remove()
    const img = doc.createElement('img')
    img.onerror = () => { remove(); reject(new Error('สร้างภาพใบเสร็จไม่สำเร็จ')) }
    img.onload = () => {
      win.addEventListener('afterprint', remove, { once: true })
      setTimeout(remove, 120000) // กันค้าง (บางเบราว์เซอร์ไม่ส่ง afterprint)
      win.focus()
      win.print()
      resolve()
    }
    img.src = canvas.toDataURL('image/png')
    doc.body.appendChild(img)
  })
}

export function printReceipt(canvas, driver = getDriver()) {
  return driver === 'escpos' ? printViaApi(canvas) : printViaBrowser(canvas)
}
