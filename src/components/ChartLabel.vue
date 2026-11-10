<script setup>
// ป้ายกำกับกราฟ: หมวด (ป้ายสี) · ชื่อกราฟ · อ่านกราฟนี้ยังไง · แกนนอน/แกนตั้งคืออะไร
defineProps({
  tag: { type: String, required: true },
  tone: { type: String, default: 'blue' }, // blue | green | amber | red | violet | slate
  title: { type: String, required: true },
  desc: String,
  x: String,
  y: String,
})
</script>

<template>
  <div class="cl">
    <div class="cl__row">
      <span class="cl__tag" :class="`cl__tag--${tone}`">{{ tag }}</span>
      <h2>{{ title }}</h2>
    </div>
    <p v-if="desc" class="cl__desc">{{ desc }}</p>
    <p v-if="x || y" class="cl__axes">
      <span v-if="x"><b>แกนนอน</b> {{ x }}</span>
      <span v-if="y"><b>แกนตั้ง</b> {{ y }}</span>
    </p>
  </div>
</template>

<style scoped>
.cl { display: flex; flex-direction: column; gap: 3px; min-width: 0; max-width: 560px; }
.cl__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
h2 { font-size: 15px; font-weight: 700; color: var(--slate-900); }
.cl__tag { padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; border: 1px solid; white-space: nowrap; }
.cl__tag--blue { background: var(--blue-50); color: var(--blue-700); border-color: var(--blue-100); }
.cl__tag--green { background: #f0fdf4; color: #15803d; border-color: #86efac; }
.cl__tag--amber { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; }
.cl__tag--red { background: var(--red-50); color: var(--red-700); border-color: #fecaca; }
.cl__tag--violet { background: #f5f3ff; color: #6d28d9; border-color: #c4b5fd; }
.cl__tag--slate { background: var(--slate-100); color: var(--slate-700); border-color: var(--slate-200); }
.cl__desc { font-size: 12px; line-height: 1.5; color: var(--slate-600); }
.cl__axes { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 11px; color: var(--slate-500); }
.cl__axes b { font-weight: 700; color: var(--slate-600); margin-right: 4px; }
</style>
