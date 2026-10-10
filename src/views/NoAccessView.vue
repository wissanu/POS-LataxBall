<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()

async function exit() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <section class="na glass">
    <h1>บัญชีนี้ยังไม่มีสิทธิ์ใช้งานหน้าใด</h1>
    <p>ติดต่อผู้ดูแลระบบเพื่อให้กำหนดสิทธิ์การเข้าถึงให้ แล้วเข้าสู่ระบบใหม่อีกครั้ง</p>
    <BaseButton variant="soft" @click="exit">ออกจากระบบ</BaseButton>
  </section>
</template>

<style scoped>
.na { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center; }
h1 { font-size: 20px; font-weight: 800; color: var(--slate-900); }
p { font-size: 13px; color: var(--slate-500); max-width: 380px; margin-bottom: 8px; }
</style>
