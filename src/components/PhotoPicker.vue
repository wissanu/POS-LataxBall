<script setup>
// แนบรูปยางของบิลนี้ (ไม่บังคับ ≤ 6 รูป) — เลือกไฟล์ / ถ่ายจากกล้อง (มือถือ-แท็บเล็ต) แล้วย่อรูปให้เล็กก่อนส่ง
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import { fileToPhoto } from '@/utils/image'

const MAX = 6
const cart = useCartStore()
const toast = useToast()
const input = ref(null)
const busy = ref(false)
let seq = 0

async function onFiles(e) {
  const files = [...(e.target.files ?? [])]
  e.target.value = ''
  if (!files.length) return
  busy.value = true
  try {
    for (const f of files) {
      if (cart.photos.length >= MAX) { toast.error(`แนบรูปได้ไม่เกิน ${MAX} รูปต่อบิล`); break }
      try { cart.photos.push({ id: ++seq, ...(await fileToPhoto(f)) }) } catch (err) { toast.error(err?.message || 'อ่านรูปไม่สำเร็จ') }
    }
  } finally { busy.value = false }
}
const remove = (id) => { cart.photos = cart.photos.filter((p) => p.id !== id) }
</script>

<template>
  <section class="pp" aria-label="รูปยาง">
    <div class="pp__head">
      <h3><AppIcon name="image" :size="14" /> รูปยาง <small>(ไม่บังคับ · {{ cart.photos.length }}/{{ MAX }})</small></h3>
      <button type="button" class="pp__add" :disabled="busy || cart.photos.length >= MAX" @click="input.click()">{{ busy ? 'กำลังย่อรูป…' : '+ เพิ่มรูป' }}</button>
      <input ref="input" type="file" accept="image/*" multiple hidden @change="onFiles" />
    </div>
    <ul v-if="cart.photos.length" class="pp__list">
      <li v-for="p in cart.photos" :key="p.id"><img :src="p.thumb" alt="รูปยาง" /><button type="button" :aria-label="`ลบรูป ${p.id}`" @click="remove(p.id)">×</button></li>
    </ul>
    <p v-else class="pp__hint">แนบรูปไว้ดูภายหลังว่ายางของลูกค้าวันนั้นหน้าตาเป็นอย่างไร (แสดงที่บิลขายโรงงานรายลูกค้า)</p>
  </section>
</template>

<style scoped>
.pp { margin: 8px 0; padding: 8px 10px; border: 1px dashed var(--slate-200); border-radius: var(--radius-md); background: #fff; }
.pp__head { display: flex; align-items: center; gap: 8px; } .pp__head h3 { font-size: 12px; font-weight: 700; color: var(--slate-800); display: inline-flex; align-items: center; gap: 5px; flex: 1; } .pp__head small { font-weight: 500; color: var(--slate-400); }
.pp__add { font-size: 12px; font-weight: 700; color: var(--blue-700); padding: 4px 10px; border-radius: 9px; background: var(--blue-50); border: 1px solid var(--blue-100); } .pp__add:disabled { opacity: .5; }
.pp__list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.pp__list li { position: relative; width: 56px; height: 56px; border-radius: 8px; overflow: hidden; border: 1px solid var(--slate-200); }
.pp__list img { width: 100%; height: 100%; object-fit: cover; }
.pp__list button { position: absolute; top: 1px; right: 1px; width: 18px; height: 18px; border-radius: 9999px; background: rgba(15, 23, 42, .7); color: #fff; font-size: 13px; line-height: 1; }
.pp__hint { margin-top: 6px; font-size: 11px; color: var(--slate-400); line-height: 1.5; }
</style>
