import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { setAuthFailureHandler } from './services/http'
import { TOKEN_KEYS } from './utils/token'
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

// Signed out in another tab? Follow along.
window.addEventListener('storage', (e) => {
  if (e.key === TOKEN_KEYS.REFRESH_KEY && !e.newValue) goToLogin()
})

app.mount('#app')
