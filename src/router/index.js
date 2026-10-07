import { createRouter, createWebHistory } from 'vue-router'
import { registerAuthGuard } from './guards'

const placeholder = (title, roles) => ({
  component: () => import('@/views/PlaceholderView.vue'),
  meta: { requiresAuth: true, title, ...(roles ? { roles } : {}) },
})

// NOTE: the POS shell is listed first so "/" resolves to its redirect child.
const routes = [
  // ---- POS shell (top bar + 2-item sidebar) ----
  {
    path: '/',
    component: () => import('@/layouts/PosLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'new-order' } },
      { path: 'new-order', name: 'new-order', component: () => import('@/views/NewOrderView.vue'), meta: { requiresAuth: true, title: 'New Order' } },
      { path: 'orders', name: 'orders', component: () => import('@/views/OrderListView.vue'), meta: { requiresAuth: true, title: 'Orders' } },
    ],
  },

  // ---- Dashboard shell (full sidebar) ----
  {
    path: '/',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', name: 'dashboard', ...placeholder('Dashboard') },
      { path: 'tables', name: 'tables', ...placeholder('Table & Floor Plan') },
      { path: 'reports', name: 'reports', ...placeholder('Sales Reports', ['manager']) },
      { path: 'menu', name: 'menu', ...placeholder('Menu Management', ['manager']) },
      { path: 'inventory', name: 'inventory', ...placeholder('Inventory Reports') },
      { path: 'shifts', name: 'shifts', ...placeholder('Shift & Cash Log') },
      { path: 'customers', name: 'customers', ...placeholder('Customer Directory') },
      { path: 'settings', name: 'settings', ...placeholder('Store Settings', ['manager']) },
      { path: 'help', name: 'help', ...placeholder('Help Center') },
    ],
  },

  // ---- public ----
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, title: 'Sign in' } },
      { path: 'register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true, title: 'Create account' } },
    ],
  },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: 'Not found' } },
]

const router = createRouter({ history: createWebHistory(), routes })

registerAuthGuard(router)
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · eatspace POS` : 'eatspace POS'
})

export default router
