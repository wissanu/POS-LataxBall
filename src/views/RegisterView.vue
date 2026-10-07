<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/services/http'

const router = useRouter()
const auth = useAuthStore()

const categories = [
  { v: 'cafe', label: 'Café', icon: 'cup' },
  { v: 'dine-in', label: 'Dine-In', icon: 'utensils' },
  { v: 'bakery', label: 'Bakery', icon: 'cake' },
  { v: 'fast-food', label: 'Fast Food', icon: 'bag' },
  { v: 'bar', label: 'Bar', icon: 'cocktail' },
]

const form = reactive({ category: 'cafe', storeName: '', terminalId: 'Terminal 01', fullName: '', email: '', pin: '' })
const showPin = ref(false)
const errors = reactive({})
const serverError = ref('')

function validate() {
  const e = {}
  if (!form.storeName.trim()) e.storeName = 'Enter your store name.'
  if (!form.terminalId.trim()) e.terminalId = 'Enter a terminal name.'
  if (!form.fullName.trim()) e.fullName = 'Enter the manager’s full name.'
  if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid work email.'
  if (!/^\d{6}$/.test(form.pin)) e.pin = 'The PIN must be exactly 6 digits.'
  Object.keys(errors).forEach((k) => delete errors[k])
  Object.assign(errors, e)
  return !Object.keys(e).length
}

async function submit() {
  serverError.value = ''
  if (!validate()) return
  try {
    await auth.register({ ...form, storeName: form.storeName.trim(), fullName: form.fullName.trim(), email: form.email.trim() })
    router.replace({ name: 'new-order' })
  } catch (e) {
    serverError.value = getErrorMessage(e, 'Could not create the account.')
  }
}
</script>

<template>
  <main class="stage">
    <form class="card" novalidate @submit.prevent="submit">
      <header class="brand">
        <div><b>eatspace</b><em>POS Terminal</em></div>
        <span class="ready"><i /> Ready to Bind</span>
      </header>

      <h1>Create Store &amp; Terminal Account</h1>
      <p class="sub">Set up your POS station, table management, and cashier staff in seconds.</p>

      <p v-if="serverError" class="alert" role="alert">{{ serverError }}</p>

      <fieldset class="cats">
        <legend>Store Category</legend>
        <div>
          <label v-for="c in categories" :key="c.v" :class="{ on: form.category === c.v }">
            <input v-model="form.category" type="radio" name="category" :value="c.v" />
            <AppIcon :name="c.icon" :size="14" /> {{ c.label }}
          </label>
        </div>
      </fieldset>

      <div class="grid">
        <BaseInput v-model="form.storeName" size="sm" label="Store / Restaurant Name" icon="store" placeholder="Eatspace Artisan Bistro" :error="errors.storeName" />
        <BaseInput v-model="form.terminalId" size="sm" label="Terminal & Station Identifier" icon="table" placeholder="Terminal 01" :error="errors.terminalId" />
        <BaseInput v-model="form.fullName" size="sm" label="Manager / Cashier Full Name" icon="user" placeholder="Sophia Grant" autocomplete="name" :error="errors.fullName" />
        <BaseInput v-model="form.email" size="sm" label="Work Email Address" icon="mail" type="email" placeholder="sophia.grant@eatspace.io" autocomplete="email" :error="errors.email" />
      </div>

      <BaseInput v-model="form.pin" size="sm" label="Shift Access Passcode (6-Digit PIN)" icon="lock" :type="showPin ? 'text' : 'password'" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="new-password" :error="errors.pin">
        <template #hint><small>Numeric PIN for POS clock-in</small></template>
        <template #trailing>
          <button type="button" class="eye" :aria-label="showPin ? 'Hide PIN' : 'Show PIN'" @click="showPin = !showPin"><AppIcon :name="showPin ? 'eye-off' : 'eye'" :size="18" /></button>
        </template>
      </BaseInput>

      <div class="note">
        <span><AppIcon name="table" :size="16" /></span>
        <div>
          <b>Table Grid &amp; Live Order Line Enabled</b>
          <p>Includes instant dining status, real-time ticket checkout, and QRIS payments.</p>
        </div>
      </div>

      <BaseButton type="submit" size="lg" block :loading="auth.loading">Initialize Terminal &amp; Register <AppIcon name="chevron-right" :size="16" /></BaseButton>
      <p class="foot">Already have a registered terminal? <router-link :to="{ name: 'login' }">Sign in to session</router-link></p>
    </form>

    <p class="micro">eatspace OS v2.4 <i /> <AppIcon name="lock" :size="10" /> Encrypted Terminal Binding <i /> Store Open Engine</p>
  </main>
</template>

<style scoped>
.stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; gap: 16px; }
.card { width: 672px; max-width: 100%; padding: 41px; border-radius: 28px; background: rgba(255, 255, 255, .88); border: 1px solid #fff; box-shadow: 0 25px 50px -12px rgba(30, 64, 175, .18); backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 18px; }
.brand { display: flex; justify-content: space-between; align-items: center; padding-bottom: 17px; border-bottom: 1px solid var(--slate-100); }
.brand b { font-size: 28px; font-weight: 800; letter-spacing: -.8px; color: var(--slate-900); }
.brand em { font-style: normal; font-size: 11px; font-weight: 600; color: var(--blue-700); background: var(--blue-50); border: 1px solid var(--blue-100); border-radius: 9999px; padding: 3px 11px; margin-left: 8px; vertical-align: 5px; }
.ready { display: flex; align-items: center; gap: 8px; padding: 6px 13px; border-radius: 9999px; background: var(--blue-50); border: 1px solid var(--blue-100); font-size: 11px; font-weight: 500; color: var(--slate-700); }
.ready i { width: 8px; height: 8px; border-radius: 50%; background: var(--green-700); }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); margin-bottom: -10px; }
.sub { font-size: 14px; color: var(--slate-600); }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; font-weight: 500; }
.cats { border: 0; padding: 0; margin: 0; }
.cats legend { font-size: 12px; font-weight: 600; color: var(--slate-700); margin-bottom: 8px; padding: 0; }
.cats div { display: flex; flex-wrap: wrap; gap: 8px; }
.cats label { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: var(--radius-md); background: #fff; border: 1px solid var(--slate-200); font-size: 12px; font-weight: 500; color: var(--slate-700); cursor: pointer; }
.cats label.on { background: var(--blue-600); border-color: var(--blue-600); color: #fff; font-weight: 600; box-shadow: var(--shadow-blue); }
.cats input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
.cats label:focus-within { outline: 2px solid var(--blue-600); outline-offset: 2px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.eye { color: var(--slate-500); display: grid; place-items: center; }
small { font-size: 11px; color: var(--slate-500); }
.note { display: flex; gap: 12px; align-items: center; padding: 15px; background: rgba(239, 246, 255, .6); border: 1px solid var(--blue-100); border-radius: 16px; }
.note > span { width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--blue-100); color: var(--blue-700); display: grid; place-items: center; flex: none; }
.note b { font-size: 12px; font-weight: 600; color: var(--slate-900); }
.note p { font-size: 11px; color: var(--slate-600); }
.foot { text-align: center; font-size: 13px; color: var(--slate-600); }
.foot a { font-weight: 600; color: var(--blue-700); margin-left: 4px; }
.micro { display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--slate-600); }
.micro i { width: 4px; height: 4px; border-radius: 50%; background: var(--slate-500); }
@media (max-width: 640px) { .card { padding: 24px 18px; } .grid { grid-template-columns: 1fr; } .micro { flex-wrap: wrap; justify-content: center; } }
</style>
