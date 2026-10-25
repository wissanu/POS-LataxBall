<script setup>
// สัญลักษณ์แบรนด์: หยดน้ำยางพารา + เส้นใบยางพาราอยู่ภายใน บนพื้นเขียวเข้ม (SVG ล้วน ไม่พึ่งไฟล์ภาพ)
import { useId } from 'vue'
defineProps({ size: { type: Number, default: 36 } })
const gid = `bm-${useId()}` // id ไม่ซ้ำเมื่อมีหลายโลโก้ในหน้าเดียว
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" role="img" aria-label="โลโก้" class="mark">
    <defs>
      <linearGradient :id="gid" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#1f8a63" /><stop offset="1" stop-color="#0a4d3c" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" :fill="`url(#${gid})`" />
    <path d="M32 11C32 11 16.5 27 16.5 38.5a15.5 15.5 0 0 0 31 0C47.5 27 32 11 32 11Z" fill="#fff" />
    <g fill="none" stroke="#0f6a50" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 52V27" /><path d="M32 44.5c-3.2-.4-5.6-2.2-7-4.8" /><path d="M32 44.5c3.2-.4 5.6-2.2 7-4.8" />
      <path d="M32 36c-2.4-.4-4.3-1.8-5.4-3.8" /><path d="M32 36c2.4-.4 4.3-1.8 5.4-3.8" />
    </g>
  </svg>
</template>

<style scoped>
.mark { display: block; flex: none; filter: drop-shadow(0 2px 6px rgba(10, 77, 60, .22)); }
</style>
