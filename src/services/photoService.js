import { http } from './http'

// รูปยางของใบรับซื้อ — GET /photos/:id (เต็ม) · /photos/:id?thumb=1 (รูปย่อ) ต้องใช้ token จึงดึงเป็น blob แล้วทำ URL ให้ <img>
// เก็บ URL ไว้ในหน่วยความจำ (รหัสรูปไม่เปลี่ยนเนื้อหา) — เปิดซ้ำไม่ดึงใหม่
const cache = new Map()
export const photoService = {
  url(id, thumb = false) {
    const key = `${id}:${thumb ? 't' : 'f'}`
    if (!cache.has(key)) {
      cache.set(key, http.get(`/photos/${id}`, { params: thumb ? { thumb: 1 } : {}, responseType: 'blob', timeout: 30000 })
        .then((r) => URL.createObjectURL(r.data))
        .catch((e) => { cache.delete(key); throw e }))
    }
    return cache.get(key)
  },
}
