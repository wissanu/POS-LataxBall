<script setup>
// รูป default ของก้อนถ้วยยาง (src/assets/latex-lump.svg) — อยากเปลี่ยนเป็นรูปถ่ายจริง
// แค่วางไฟล์ใหม่ทับชื่อเดิม หรือเปลี่ยนบรรทัด import นี้
import lumpUrl from '@/assets/latex-lump.svg'
</script>

<template>
  <img :src="lumpUrl" alt="" draggable="false" class="lump" />
</template>

<style scoped>
.lump { display: block; width: 100%; height: 100%; object-fit: contain; user-select: none; }
</style>
