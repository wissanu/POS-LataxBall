<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppBackground from '@/components/AppBackground.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const tabs = ['Order line', 'Table', 'Dishes', 'Delivery', 'Account']
const activeTab = ref('Table')
const badges = [
  { t: 'J', bg: '#fecdd3', fg: '#9f1239' },
  { t: 'T', bg: '#c7d2fe', fg: '#3730a3' },
  { t: 'B', bg: '#92400e', fg: '#fff' },
]

async function exit() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <AppBackground />

    <header class="top">
      <div class="top__left">
        <router-link to="/" class="logo">eat<span>space</span></router-link>
        <nav aria-label="Sections">
          <button v-for="t in tabs" :key="t" type="button" :class="{ on: t === activeTab }" @click="activeTab = t">{{ t }}</button>
        </nav>
      </div>
      <div class="top__right">
        <label class="search">
          <AppIcon name="search" />
          <input placeholder="Search menu, order, etc" />
        </label>
        <button class="round" type="button" aria-label="Notifications"><AppIcon name="bell" /></button>
        <div class="badges">
          <span v-for="b in badges" :key="b.t" :style="{ background: b.bg, color: b.fg }">{{ b.t }}</span>
        </div>
      </div>
    </header>

    <div class="body">
      <aside class="side glass">
        <div>
          <div class="me">
            <span class="me__av">{{ (auth.user?.name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('') }}</span>
            <div>
              <h4>{{ auth.user?.name }}</h4>
              <p>{{ auth.user?.title || 'Cashier' }}</p>
            </div>
          </div>
          <p class="group">POS Navigation</p>
          <router-link :to="{ name: 'orders' }" class="link" active-class="link--on"><AppIcon name="clipboard" /> Order List</router-link>
          <router-link :to="{ name: 'new-order' }" class="link" active-class="link--on"><AppIcon name="plus" /> New Order</router-link>
        </div>
        <button class="exit" type="button" @click="exit"><AppIcon name="logout" /> Exit Session</button>
      </aside>

      <router-view />
    </div>
  </div>
</template>

<style scoped>
.shell { position: relative; height: 100%; display: flex; flex-direction: column; }
.top, .body { position: relative; z-index: 1; }
.top { height: 64px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 24px;
  background: rgba(230, 239, 250, .8); backdrop-filter: blur(6px); border-bottom: 1px solid rgba(255, 255, 255, .6); }
.top__left, .top__right { display: flex; align-items: center; gap: 40px; }
.top__right { gap: 16px; }
.logo { font-size: 24px; font-weight: 800; letter-spacing: -0.6px; color: var(--blue-600); line-height: 32px; }
.logo span { color: var(--slate-900); }
nav { display: flex; gap: 28px; }
nav button { font-size: 14px; font-weight: 500; color: var(--slate-500); padding: 2px 0 4px; border-bottom: 2px solid transparent; }
nav button.on { color: var(--blue-600); font-weight: 600; border-color: var(--blue-600); }
.search { display: flex; align-items: center; gap: 8px; width: 256px; height: 30px; padding: 0 12px; border-radius: 9999px; background: rgba(255, 255, 255, .7); border: 1px solid #fff; color: var(--slate-400); }
.search input { border: 0; background: none; outline: none; font-size: 12px; flex: 1; color: var(--slate-800); }
.round { width: 36px; height: 36px; border-radius: 50%; background: var(--glass-strong); display: grid; place-items: center; box-shadow: 0 1px 2px rgba(0, 0, 0, .05); color: var(--slate-600); }
.badges { display: flex; gap: 6px; padding-left: 9px; border-left: 1px solid rgba(203, 213, 225, .6); }
.badges span { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; }

.body { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 12px; }
.side { width: 224px; flex: none; padding: 17px; display: flex; flex-direction: column; justify-content: space-between; }
.me { display: flex; align-items: center; gap: 12px; padding: 4px 8px; margin-bottom: 24px; }
.me__av { width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--blue-100); color: var(--blue-700); font-weight: 700; font-size: 14px; display: grid; place-items: center; box-shadow: inset 0 2px 4px rgba(0, 0, 0, .05); }
.me h4 { font-size: 12px; font-weight: 700; color: var(--slate-800); }
.me p { font-size: 11px; color: var(--slate-400); }
.group { font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--slate-400); padding: 0 12px 10px; }
.link { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; color: var(--slate-600); margin-bottom: 6px; }
.link:hover { background: rgba(255, 255, 255, .7); }
.link--on, .link--on:hover { background: var(--blue-600); color: #fff; font-weight: 600; box-shadow: var(--shadow-blue); }
.exit { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; color: var(--slate-500); border-top: 1px solid rgba(226, 232, 240, .6); margin-top: 17px; padding-top: 25px; }
.exit:hover { color: #dc2626; }
@media (max-width: 1100px) { nav { display: none; } .side { display: none; } }
</style>
