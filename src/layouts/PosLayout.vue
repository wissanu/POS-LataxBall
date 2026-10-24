<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppBackground from '@/components/AppBackground.vue'
import AppIcon from '@/components/AppIcon.vue'
import TopSearch from '@/components/TopSearch.vue'
import { useAuthStore } from '@/stores/auth'
import { firstLetter } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()

const tabs = ['Order line', 'Table', 'Dishes', 'Delivery', 'Account']
const activeTab = ref('Table')

// ---- sidebar: 1) รายงานภาพรวม · 3) New Order · 4) Order List · 2) จัดแต่งระบบ, with divider lines (5) between the groups ----
// Each link shows only if the signed-in user holds its permission (see 03_rbac.sql).
const menu = [
  { to: 'reports', label: 'รายงานภาพรวม', icon: 'chart', perm: ['report.view'] },
  { divider: true },
  { to: 'new-order', label: 'New Order', icon: 'plus', perm: ['purchase.create'] },
  { to: 'orders', label: 'Order List', icon: 'clipboard', perm: ['purchase.read'] },
  { to: 'transport', label: 'การขนส่ง', icon: 'truck', perm: ['purchase.read'] },
  { divider: true },
  { to: 'system', label: 'จัดแต่งระบบ', icon: 'gear', perm: ['user.manage', 'role.manage'] },
]
const items = computed(() => {
  const shown = menu.filter((m) => m.divider || auth.canAny(...m.perm))
  // never start/end with a divider or show two in a row
  return shown.filter((m, i) => !m.divider || (i > 0 && i < shown.length - 1 && !shown[i - 1].divider))
})

// ---- avatar menu (top right): one circle, click -> log out only ----
const menuOpen = ref(false)
const avatarRoot = ref(null)
const avatarBtn = ref(null)
const letter = computed(() => firstLetter(auth.user?.name))

function onPointerDown(e) {
  if (menuOpen.value && !avatarRoot.value?.contains(e.target)) menuOpen.value = false
}
function onKeydown(e) {
  if (e.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    avatarBtn.value?.focus()
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

async function exit() {
  menuOpen.value = false
  await auth.logout() // revokes the session, clears tokens and reloads the login page
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
        <TopSearch />
        <button class="round" type="button" aria-label="Notifications"><AppIcon name="bell" /></button>
        <div ref="avatarRoot" class="badges">
          <button
            ref="avatarBtn" type="button" class="avatar" :style="{ background: auth.avatar.bg, color: auth.avatar.fg }"
            aria-haspopup="menu" :aria-expanded="menuOpen" :aria-label="`บัญชีของ ${auth.user?.name ?? ''}`"
            @click="menuOpen = !menuOpen"
          >{{ letter }}</button>
          <div v-if="menuOpen" class="pop" role="menu">
            <button type="button" role="menuitem" class="pop__item" @click="exit"><AppIcon name="logout" :size="15" /> ออกจากระบบ</button>
          </div>
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
          <nav class="menu" aria-label="POS Navigation">
            <template v-for="(m, i) in items" :key="m.to ?? `divider-${i}`">
              <hr v-if="m.divider" class="sep" />
              <router-link v-else :to="{ name: m.to }" class="link" active-class="link--on"><AppIcon :name="m.icon" /> {{ m.label }}</router-link>
            </template>
          </nav>
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
.top { z-index: 3; } /* above .body so the avatar pop-up is not covered */
.top { height: 64px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 24px;
  background: rgba(230, 239, 250, .8); backdrop-filter: blur(6px); border-bottom: 1px solid rgba(255, 255, 255, .6); }
.top__left, .top__right { display: flex; align-items: center; gap: 40px; }
.top__right { gap: 16px; }
.logo { font-size: 24px; font-weight: 800; letter-spacing: -0.6px; color: var(--blue-600); line-height: 32px; }
.logo span { color: var(--slate-900); }
.top nav { display: flex; gap: 28px; }
.top nav button { font-size: 14px; font-weight: 500; color: var(--slate-500); padding: 2px 0 4px; border-bottom: 2px solid transparent; }
.top nav button.on { color: var(--blue-600); font-weight: 600; border-color: var(--blue-600); }
.round { width: 36px; height: 36px; border-radius: 50%; background: var(--glass-strong); display: grid; place-items: center; box-shadow: 0 1px 2px rgba(0, 0, 0, .05); color: var(--slate-600); }
.badges { position: relative; display: flex; padding-left: 9px; border-left: 1px solid rgba(203, 213, 225, .6); }
.avatar { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); transition: box-shadow .15s; }
.avatar:hover, .avatar[aria-expanded='true'] { box-shadow: 0 0 0 3px rgba(37, 99, 235, .18); }
.pop { position: absolute; right: 0; top: calc(100% + 10px); z-index: 20; min-width: 168px; padding: 6px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); box-shadow: var(--shadow-panel); }
.pop__item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--slate-700); text-align: left; }
.pop__item:hover { background: var(--red-50); color: #dc2626; }

.body { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 12px; }
.side { width: 224px; flex: none; padding: 17px; display: flex; flex-direction: column; justify-content: space-between; }
.me { display: flex; align-items: center; gap: 12px; padding: 4px 8px; margin-bottom: 24px; }
.me__av { width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--blue-100); color: var(--blue-700); font-weight: 700; font-size: 14px; display: grid; place-items: center; box-shadow: inset 0 2px 4px rgba(0, 0, 0, .05); }
.me h4 { font-size: 12px; font-weight: 700; color: var(--slate-800); }
.me p { font-size: 11px; color: var(--slate-400); }
.group { font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--slate-400); padding: 0 12px 10px; }
.menu { display: flex; flex-direction: column; }
.sep { width: calc(100% - 16px); margin: 8px 8px 12px; border: 0; border-top: 1px solid var(--slate-300); opacity: .8; }
.link { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; color: var(--slate-600); margin-bottom: 6px; }
.link:hover { background: rgba(255, 255, 255, .7); }
.link--on, .link--on:hover { background: var(--blue-600); color: #fff; font-weight: 600; box-shadow: var(--shadow-blue); }
.exit { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; color: var(--slate-500); border-top: 1px solid rgba(226, 232, 240, .6); margin-top: 17px; padding-top: 25px; }
.exit:hover { color: #dc2626; }
@media (max-width: 1100px) { .top nav { display: none; } .side { display: none; } }
</style>
