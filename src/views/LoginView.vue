<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/services/http'
import { homeRouteFor } from '@/router/guards'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const LAST_KEY = 'eatspace.lastUsername'
const identifier = ref(localStorage.getItem(LAST_KEY) || '')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)
const error = ref('')
const passwordInput = ref(null)
const notice = computed(() => (route.query.reason === 'expired' ? 'Your session expired. Please sign in again.' : ''))

async function submit() {
  error.value = ''
  if (!identifier.value.trim() || !password.value) {
    error.value = 'Enter your username and password.'
    return
  }
  try {
    await auth.login({ username: identifier.value.trim(), password: password.value })
    if (remember.value) localStorage.setItem(LAST_KEY, identifier.value.trim())
    else localStorage.removeItem(LAST_KEY)
    const r = route.query.redirect
    // only follow same-site paths (prevents open redirects)
    router.replace(typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : homeRouteFor(auth))
  } catch (e) {
    error.value = getErrorMessage(e, 'Could not sign in.')
    password.value = ''
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
      <p class="sub">Enter your username and password to unlock the register session</p>

      <div class="pills">
        <span><AppIcon name="store" :size="13" /> Terminal #01</span>
        <span><AppIcon name="sun" :size="13" /> Morning Shift</span>
      </div>

      <p v-if="notice" class="alert alert--info" role="status">{{ notice }}</p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>

      <div class="fields">
        <BaseInput v-model="identifier" label="Username" icon="id" placeholder="admin" autocomplete="username" />
        <BaseInput ref="passwordInput" v-model="password" label="Password" icon="lock" :type="showPassword ? 'text' : 'password'" placeholder="••••••" autocomplete="current-password">
          <template #hint><a class="link" href="#" @click.prevent>Forgot password?</a></template>
          <template #trailing>
            <button type="button" class="eye" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" /></button>
          </template>
        </BaseInput>
      </div>

      <div class="util">
        <label class="check"><input v-model="remember" type="checkbox" /> Remember terminal station</label>
        <button type="button" class="plain">Switch Device</button>
      </div>

      <BaseButton type="submit" size="lg" block :loading="auth.loading">Unlock Register <AppIcon name="chevron-right" :size="16" /></BaseButton>

      <p class="foot">Need an account? Ask your system administrator.</p>
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
.foot { text-align: center; font-size: 12px; color: var(--slate-600); margin-top: 22px; }
.foot a { font-weight: 600; color: var(--blue-700); margin-left: 4px; }
.bottom { display: flex; justify-content: space-between; padding: 12px 24px; font-size: 12px; color: var(--slate-600); }
.bottom span { display: flex; align-items: center; gap: 8px; }
.bottom svg { color: var(--green-700); }
.bottom i { width: 4px; height: 4px; border-radius: 50%; background: var(--slate-300); }
@media (max-width: 560px) { .card { padding: 28px 20px; } .bottom { flex-direction: column; gap: 6px; align-items: center; } .status { display: none; } }
</style>
