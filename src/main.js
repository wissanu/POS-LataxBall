import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { setAuthFailureHandler } from './services/http'
import { TOKEN_KEYS } from './utils/token'
import { decodeJwt } from './utils/jwt'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router)

const auth = useAuthStore()

const goToLogin = () => {
  auth.clearSession()
  const current = router.currentRoute.value
  if (current.name !== 'login') router.push({ name: 'login', query: { redirect: current.fullPath, reason: 'expired' } })
}

// A request failed and the refresh token could not rescue it -> back to the login screen
setAuthFailureHandler(goToLogin)

// Another tab signed out -> follow along. Another tab signed in as someone else (different session id) -> reload,
// otherwise this tab would keep showing the previous user. A plain token rotation keeps the same session id and is ignored.
window.addEventListener('storage', (e) => {
  if (e.key !== TOKEN_KEYS.REFRESH_KEY) return
  if (!e.newValue) return goToLogin()
  const before = e.oldValue ? decodeJwt(e.oldValue)?.sid : null
  const after = decodeJwt(e.newValue)?.sid
  if (before && after && before !== after) window.location.reload()
})

app.mount('#app')
