<script setup>
// รูปที่ต้องใช้ token ดึง (รูปยางในฐานข้อมูล) — ดึงเป็น blob แล้วแสดง · รูปย่อ = thumb
import { onMounted, ref, watch } from 'vue'
import { photoService } from '@/services/photoService'

const props = defineProps({ id: { type: String, required: true }, thumb: Boolean, alt: { type: String, default: 'รูปยาง' } })
const src = ref('')
const failed = ref(false)
async function load() {
  failed.value = false; src.value = ''
  try { src.value = await photoService.url(props.id, props.thumb) } catch { failed.value = true }
}
onMounted(load)
watch(() => [props.id, props.thumb], load)
</script>

<template>
  <img v-if="src" :src="src" :alt="alt" loading="lazy" />
  <span v-else class="ph" :class="{ bad: failed }">{{ failed ? 'โหลดรูปไม่ได้' : '…' }}</span>
</template>

<style scoped>
img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ph { display: grid; place-items: center; width: 100%; height: 100%; font-size: 10px; color: var(--slate-400); background: var(--slate-100); }
.ph.bad { color: #dc2626; }
</style>
