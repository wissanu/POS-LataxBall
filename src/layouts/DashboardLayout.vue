<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppBackground from '@/components/AppBackground.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { initials } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()

const main = [
  { to: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { to: 'tables', label: 'Table & Floor Plan', icon: 'table' },
  { to: 'orders', label: 'Orders', icon: 'receipt' },
  { to: 'reports', label: 'Sales Reports', icon: 'chart', roles: ['manager'] },
  { to: 'menu', label: 'Menu Management', icon: 'book', roles: ['manager'] },
]
const ops = [
  { to: 'inventory', label: 'Inventory Reports', icon: 'box' },
  { to: 'shifts', label: 'Shift & Cash Log', icon: 'cash' },
  { to: 'customers', label: 'Customer Directory', icon: 'users' },
]
const allowed = (list) => list.filter((i) => !i.roles || i.roles.includes(auth.role))
const mainItems = computed(() => allowed(main))

const now = ref(new Date())
let timer
onMounted(() => { timer = setInterval(() => (now.value = new Date()), 30000) })
onBeforeUnmount(() => clearInterval(timer))
const shift = computed(() => {
  const h = now.value.getHours()
  const name = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
  return `${name} Shift • ${now.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
})

const dark = ref(false) // visual toggle only — wire to a theme store when you add dark mode

async function signOut() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <AppBackground />

    <aside class="side">
      <div class="side__top">
        <div class="brand">
          <router-link to="/" class="brand__link">
            <span class="brand__mark"><AppIcon name="cup" :size="16" /></span>
            Sweetco
          </router-link>
          <button type="button" class="ghost" aria-label="Toggle sidebar"><AppIcon name="sidebar" :size="14" /></button>
        </div>

        <p class="group">Main</p>
        <router-link v-for="i in mainItems" :key="i.to" :to="{ name: i.to }" class="link" active-class="link--on"><AppIcon :name="i.icon" /> {{ i.label }}</router-link>

        <p class="group group--ops">Operations</p>
        <router-link v-for="i in ops" :key="i.to" :to="{ name: i.to }" class="link" active-class="link--on"><AppIcon :name="i.icon" /> {{ i.label }}</router-link>
      </div>

      <div class="side__bottom">
        <router-link v-if="auth.role === 'manager'" :to="{ name: 'settings' }" class="link link--quiet"><AppIcon name="settings" /> Store Settings</router-link>
        <div class="link link--quiet toggle-row">
          <span><AppIcon :name="dark ? 'sun' : 'moon'" /> Dark Mode</span>
          <button type="button" class="switch" role="switch" :aria-checked="dark" aria-label="Dark mode" :class="{ on: dark }" @click="dark = !dark"><i /></button>
        </div>
        <router-link :to="{ name: 'help' }" class="link link--quiet"><AppIcon name="help" /> Help Center</router-link>

        <div class="user">
          <span class="user__av">{{ initials(auth.user?.name) }}</span>
          <div>
            <h4>{{ auth.user?.name }}</h4>
            <p>{{ auth.user?.email }}</p>
          </div>
          <button type="button" class="ghost" aria-label="Sign out" title="Sign out" @click="signOut"><AppIcon name="logout" :size="14" /></button>
        </div>
      </div>
    </aside>

    <main class="main">
      <div class="bar">
        <label class="search">
          <AppIcon name="search" />
          <input placeholder="Search foods" />
          <kbd>⌘K</kbd>
        </label>
        <div class="bar__right">
          <span class="shift"><AppIcon name="clock" :size="13" /> {{ shift }}</span>
          <button type="button" class="round" aria-label="Notifications"><AppIcon name="bell" :size="15" /><i class="ping" /></button>
          <span class="me">{{ initials(auth.user?.name) }}</span>
        </div>
      </div>
      <div class="content scroll-y"><router-view /></div>
    </main>
  </div>
</template>

<style scoped>
.shell { position: relative; height: 100%; display: flex; gap: 16px; padding: 16px; }
.side, .main { position: relative; z-index: 1; }
.side { width: 256px; flex: none; display: flex; flex-direction: column; justify-content: space-between; background: rgba(255, 255, 255, .85); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-panel); }
.side__top { padding: 16px; overflow-y: auto; }
.brand { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--slate-100); }
.brand__link { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 800; color: var(--slate-900); }
.brand__mark { width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--blue-600); color: #fff; display: grid; place-items: center; box-shadow: var(--shadow-blue); }
.ghost { width: 28px; height: 28px; border-radius: var(--radius-sm); display: grid; place-items: center; color: var(--slate-500); }
.ghost:hover { background: var(--slate-100); }
.group { font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--slate-400); padding: 0 12px 6px; }
.group--ops { margin-top: 20px; }
.link { display: flex; align-items: center; gap: 12px; padding: 8px 12px; height: 36px; border-radius: var(--radius-md); font-size: 14px; font-weight: 500; color: var(--slate-600); margin-bottom: 4px; }
.link:hover { background: var(--slate-50); }
.link--on, .link--on:hover { background: var(--blue-600); color: #fff; font-weight: 600; box-shadow: var(--shadow-blue); }
.side__bottom { padding: 12px; border-top: 1px solid var(--slate-100); background: rgba(248, 250, 252, .6); border-radius: 0 0 var(--radius-lg) var(--radius-lg); }
.link--quiet { height: 32px; font-size: 13px; }
.toggle-row { justify-content: space-between; }
.toggle-row span { display: flex; align-items: center; gap: 12px; }
.switch { width: 32px; height: 16px; border-radius: 9999px; background: var(--slate-200); position: relative; transition: background .2s; }
.switch i { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .2s; }
.switch.on { background: var(--blue-600); }
.switch.on i { transform: translateX(16px); }
.user { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 9px; background: #fff; border: 1px solid var(--slate-100); border-radius: var(--radius-md); box-shadow: 0 1px 2px rgba(0, 0, 0, .05); }
.user__av { width: 36px; height: 36px; border-radius: 50%; background: var(--blue-100); color: var(--blue-700); display: grid; place-items: center; font-weight: 700; font-size: 12px; flex: none; }
.user div { flex: 1; min-width: 0; }
.user h4 { font-size: 12px; font-weight: 700; }
.user p { font-size: 11px; color: var(--slate-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; border-radius: var(--radius-lg); box-shadow: var(--shadow-panel); padding: 24px; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--slate-100); flex: none; }
.search { display: flex; align-items: center; gap: 12px; width: min(448px, 100%); height: 38px; padding: 0 14px; border-radius: 9999px; background: var(--slate-50); border: 1px solid var(--slate-200); color: var(--slate-400); }
.search input { flex: 1; border: 0; background: none; outline: none; font-size: 14px; color: var(--slate-800); }
kbd { font: 600 10px var(--font); padding: 3px 7px; border-radius: 6px; border: 1px solid var(--slate-200); background: #fff; color: var(--slate-500); }
.bar__right { display: flex; align-items: center; gap: 12px; }
.shift { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 13px; border-radius: 9999px; background: var(--slate-50); border: 1px solid var(--slate-200); font-size: 12px; font-weight: 500; color: var(--slate-700); }
.round { position: relative; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--slate-200); display: grid; place-items: center; color: var(--slate-600); background: #fff; }
.ping { position: absolute; top: 9px; right: 10px; width: 8px; height: 8px; border-radius: 50%; background: #ef4444; border: 2px solid #fff; }
.me { width: 36px; height: 36px; border-radius: 50%; background: #fecdd3; color: #9f1239; display: grid; place-items: center; font-weight: 700; font-size: 12px; }
.content { flex: 1; min-height: 0; }
@media (max-width: 1000px) { .side { display: none; } .shift { display: none; } }
</style>
