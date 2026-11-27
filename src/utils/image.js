// ย่อรูปที่หน้าเว็บก่อนส่ง (รูปจากกล้องมือถือใหญ่หลาย MB) — รูปเต็มด้านยาวไม่เกิน 1280px JPEG ~100-300 KB + รูปย่อ 240px
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* ใช้วิธีสำรองด้านล่าง */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('อ่านไฟล์ภาพไม่ได้')); i.src = url })
  } finally { URL.revokeObjectURL(url) }
}
function draw(img, max, quality) {
  const w0 = img.width, h0 = img.height
  const k = Math.min(1, max / Math.max(w0, h0))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k))
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}
/** File -> { image, thumb } (data URL JPEG) */
export async function fileToPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('เลือกได้เฉพาะไฟล์ภาพ')
  const img = await decode(file)
  let image = draw(img, 1280, 0.8)
  if (image.length > 1_500_000) image = draw(img, 1000, 0.7)
  const thumb = draw(img, 240, 0.7)
  img.close?.()
  return { image, thumb }
}
