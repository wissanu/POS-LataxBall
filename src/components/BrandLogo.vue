<script setup>
// โลโก้เต็ม = สัญลักษณ์ + ชื่อ (+ คำอธิบายสั้น ๆ ถ้า tagline = true)
import BrandMark from './BrandMark.vue'
import { BRAND } from '@/config/brand'
defineProps({ size: { type: Number, default: 36 }, tagline: { type: Boolean, default: false } })
</script>

<template>
  <span class="logo">
    <BrandMark :size="size" />
    <span class="logo__text">
      <span class="logo__name" :style="{ fontSize: `${Math.round(size * 0.72)}px` }"><span>{{ BRAND.nameLight }}</span><b>{{ BRAND.nameBold }}</b></span>
      <small v-if="tagline" class="logo__tag">{{ BRAND.tagline }}</small>
    </span>
  </span>
</template>

<style scoped>
.logo { display: inline-flex; align-items: center; gap: 10px; }
.logo__text { display: flex; flex-direction: column; line-height: 1.05; }
.logo__name { letter-spacing: -.03em; color: var(--slate-900); line-height: 1.05; }
.logo__name span { font-weight: 300; }
.logo__name b { font-weight: 800; color: #0f6a50; }
.logo__tag { margin-top: 3px; font-size: 10px; letter-spacing: .18em; color: var(--slate-500); white-space: nowrap; }
</style>
