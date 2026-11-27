<script setup>
// รูปยางแบบ thumbnail เรียงแถว — คลิกเพื่อขยาย (ดูรูปเต็มเฉพาะตอนคลิก ไม่โหลดรูปใหญ่ล่วงหน้า)
import { ref } from 'vue'
import AuthImage from './AuthImage.vue'
import BaseModal from './BaseModal.vue'

defineProps({ ids: { type: Array, default: () => [] }, size: { type: Number, default: 52 } })
const open = ref(false)
const cur = ref('')
const show = (id) => { cur.value = id; open.value = true }
</script>

<template>
  <span v-if="!ids.length" class="none">ไม่มีรูป</span>
  <span v-else class="strip">
    <button v-for="id in ids" :key="id" type="button" class="th" :style="{ width: `${size}px`, height: `${size}px` }" title="คลิกเพื่อขยาย" @click.stop="show(id)"><AuthImage :id="id" thumb /></button>
  </span>
  <BaseModal v-model="open" title="รูปยาง" width="min(92vw, 860px)">
    <div class="big"><AuthImage v-if="open" :id="cur" /></div>
    <div v-if="ids.length > 1" class="nav"><button v-for="id in ids" :key="id" type="button" class="th th--s" :class="{ on: id === cur }" @click="cur = id"><AuthImage :id="id" thumb /></button></div>
  </BaseModal>
</template>

<style scoped>
.none { font-size: 11px; color: var(--slate-400); }
.strip { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.th { border-radius: 8px; overflow: hidden; border: 1px solid var(--slate-200); background: var(--slate-50); cursor: zoom-in; padding: 0; }
.th:hover { border-color: var(--blue-600); }
.big { max-height: 70vh; display: grid; place-items: center; background: var(--slate-50); border-radius: 10px; overflow: hidden; min-height: 200px; }
.big :deep(img) { object-fit: contain; max-height: 70vh; }
.nav { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.th--s { width: 56px; height: 56px; cursor: pointer; } .th--s.on { border-color: var(--blue-600); box-shadow: 0 0 0 2px var(--blue-100); }
</style>
