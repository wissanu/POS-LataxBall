<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/services/http'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const LAST_KEY = 'eatspace.lastCashier'
const identifier = ref(localStorage.getItem(LAST_KEY) || '')
const pin = ref('')
const remember = ref(true)
const showPin = ref(false)
const error = ref('')
const pinInput = ref(null)
const isMock = import.meta.env.VITE_USE_MOCK === 'true'

const quick = [
  { id: 'CASHIER-802', name: 'Sophia G.', role: 'Table Lead', ini: 'SG', bg: '#dbeafe' },
  { id: 'CASHIER-417', name: 'Liam Foster', role: 'Active Cashier', ini: 'LF', bg: '#e0e7ff' },
  { id: 'CASHIER-233', name: 'Emma Clarke', role: 'Floor Host', ini: 'EC', bg: '#a7f3d0' },
]

const notice = computed(() => (route.query.reason === 'expired' ? 'Your session expired. Please sign in again.' : ''))

function pick(c) {
  identifier.value = c.id
  pinInput.value?.$el.querySelector('input').focus()
}

async function submit() {
  error.value = ''
  if (!identifier.value.trim() || !pin.value) {
    error.value = 'Enter your cashier ID and PIN.'
    return
  }
  try {
    await auth.login({ identifier: identifier.value.trim(), pin: pin.value })
    if (remember.value) localStorage.setItem(LAST_KEY, identifier.value.trim())
    else localStorage.removeItem(LAST_KEY)
    const r = route.query.redirect
    // only follow same-site paths (prevents open redirects)
    router.replace(typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : { name: 'new-order' })
  } catch (e) {
    error.value = getErrorMessage(e, 'Could not sign in.')
    pin.value = ''
  }
}
</script>

<template>
  <header class="bar">
    <div class="brand">
      <span class="mark"><i /></span>
      <b>eatspace</b>
      <em>POS Station</em>
    </div>
    <div class="status"><i class="dot" /> Cloud Sync Active <span class="sep" /> Terminal 01</div>
  </header>

  <main class="stage">
    <form class="card" novalidate @submit.prevent="submit">
      <span class="logo"><span class="mark mark--lg"><i /></span></span>
      <h1>Sign in to Terminal</h1>
      <p class="sub">Enter your cashier credentials to unlock the register session</p>

      <div class="pills">
        <span><AppIcon name="store" :size="13" /> Terminal #01</span>
        <span><AppIcon name="sun" :size="13" /> Morning Shift</span>
      </div>

      <p v-if="notice" class="alert alert--info" role="status">{{ notice }}</p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>

      <div class="fields">
        <BaseInput v-model="identifier" label="Cashier ID or Email" icon="id" placeholder="CASHIER-802" autocomplete="username" />
        <BaseInput ref="pinInput" v-model="pin" label="Terminal PIN" icon="lock" :type="showPin ? 'text' : 'password'" placeholder="••••" inputmode="numeric" autocomplete="current-password">
          <template #hint><a class="link" href="#" @click.prevent>Forgot PIN?</a></template>
          <template #trailing>
            <button type="button" class="eye" :aria-label="showPin ? 'Hide PIN' : 'Show PIN'" @click="showPin = !showPin"><AppIcon :name="showPin ? 'eye-off' : 'eye'" :size="18" /></button>
          </template>
        </BaseInput>
      </div>

      <div class="util">
        <label class="check"><input v-model="remember" type="checkbox" /> Remember terminal station</label>
        <button type="button" class="plain">Switch Device</button>
      </div>

      <BaseButton type="submit" size="lg" block :loading="auth.loading">Unlock Register <AppIcon name="chevron-right" :size="16" /></BaseButton>

      <div class="divider"><span>Quick cashier switch</span></div>
      <div class="quick">
        <button v-for="c in quick" :key="c.id" type="button" :class="{ on: identifier === c.id }" @click="pick(c)">
          <span :style="{ background: c.bg }">{{ c.ini }}</span>
          <b>{{ c.name }}</b>
          <small>{{ c.role }}</small>
        </button>
      </div>

      <p class="foot">Need a new cashier profile? <router-link :to="{ name: 'register' }">Contact Store Manager</router-link></p>
      <p v-if="isMock" class="demo">Demo mode · any quick cashier + PIN <b>1234</b></p>
    </form>
  </main>

  <footer class="bottom">
    <span><AppIcon name="shield" :size="13" /> Secure Terminal Isolation (TLS 1.3 End-to-End)</span>
    <span>eatspace POS v2.4 <i /> Diagnostics <i /> Help Center</span>
  </footer>
</template>

<style scoped>
.bar { height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
.brand { display: flex; align-items: center; gap: 8px; }
.brand b { font-size: 20px; font-weight: 800; letter-spacing: -.5px; color: var(--slate-900); margin-left: 2px; }
.brand em { font-style: normal; font-size: 11px; font-weight: 500; color: var(--blue-700); background: #fff; border: 1px solid var(--blue-100); border-radius: 9999px; padding: 2px 9px; margin-left: 4px; }
.mark { width: 32px; height: 32px; border-radius: 50%; background: #1d4ed8; display: grid; place-items: center; }
.mark i { width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; }
.mark--lg { width: 32px; height: 32px; box-shadow: 0 4px 10px rgba(29, 78, 216, .35); }
.status { display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-radius: 9999px; background: rgba(255, 255, 255, .8); border: 1px solid #fff; font-size: 12px; font-weight: 500; color: var(--slate-700); box-shadow: 0 1px 2px rgba(0, 0, 0, .05); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green-700); }
.sep { width: 6px; height: 6px; border-radius: 50%; background: var(--slate-300); }

.stage { flex: 1; display: grid; place-items: center; padding: 24px; }
.card { width: 448px; max-width: 100%; padding: 41px; border-radius: 28px; background: rgba(255, 255, 255, .88); border: 1px solid #fff; box-shadow: 0 25px 50px -12px rgba(30, 64, 175, .18); backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 0; }
.logo { align-self: center; width: 56px; height: 56px; border-radius: 18px; background: rgba(219, 234, 254, .6); border: 1px solid #fff; display: grid; place-items: center; box-shadow: 0 4px 12px rgba(37, 99, 235, .12); margin-bottom: 12px; }
h1 { text-align: center; font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); }
.sub { text-align: center; font-size: 14px; color: var(--slate-500); line-height: 20px; margin: 8px 20px 16px; }
.pills { display: flex; justify-content: center; gap: 8px; margin-bottom: 20px; }
.pills span { display: inline-flex; align-items: center; gap: 6px; padding: 5px 13px; border-radius: 9999px; background: var(--blue-50); border: 1px solid var(--blue-100); font-size: 12px; font-weight: 500; color: var(--slate-700); }
.pills svg { color: var(--blue-600); }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; font-weight: 500; margin-bottom: 14px; }
.alert--info { background: var(--blue-50); color: var(--blue-700); border-color: var(--blue-100); }
.fields { display: flex; flex-direction: column; gap: 18px; }
.link { font-size: 12px; font-weight: 600; color: var(--blue-700); }
.eye { color: var(--slate-600); display: grid; place-items: center; }
.util { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 20px; font-size: 12px; }
.check { display: flex; align-items: center; gap: 8px; color: var(--slate-700); cursor: pointer; }
.check input { width: 16px; height: 16px; accent-color: var(--blue-600); }
.plain { font-weight: 600; color: var(--slate-700); }
.divider { position: relative; text-align: center; margin: 22px 0 16px; }
.divider::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: var(--slate-200); }
.divider span { position: relative; background: #fbfdff; padding: 0 12px; font-size: 10px; font-weight: 500; letter-spacing: .6px; text-transform: uppercase; color: var(--slate-500); }
.quick { display: flex; gap: 8px; }
.quick button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: 14px; background: rgba(248, 250, 252, .8); border: 1px solid var(--slate-100); }
.quick button.on { border: 2px solid #93c5fd; background: #fff; }
.quick button span { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: var(--slate-800); margin-bottom: 4px; }
.quick b { font-size: 12px; font-weight: 600; color: var(--slate-900); }
.quick button.on b { color: var(--blue-700); }
.quick small { font-size: 11px; color: var(--slate-600); }
.foot { text-align: center; font-size: 12px; color: var(--slate-600); margin-top: 22px; }
.foot a { font-weight: 600; color: var(--blue-700); margin-left: 4px; }
.demo { text-align: center; font-size: 11px; color: var(--slate-500); margin-top: 10px; }
.bottom { display: flex; justify-content: space-between; padding: 12px 24px; font-size: 12px; color: var(--slate-600); }
.bottom span { display: flex; align-items: center; gap: 8px; }
.bottom svg { color: var(--green-700); }
.bottom i { width: 4px; height: 4px; border-radius: 50%; background: var(--slate-300); }
@media (max-width: 560px) { .card { padding: 28px 20px; } .bottom { flex-direction: column; gap: 6px; align-items: center; } .status { display: none; } }
</style>
