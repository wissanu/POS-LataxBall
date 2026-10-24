import { createRouter, createWebHistory } from 'vue-router'
import { registerAuthGuard } from './guards'

// `permission` = permission code(s) the user must hold (any one of them) — see 03_rbac.sql
const placeholder = (title, permission) => ({
  component: () => import('@/views/PlaceholderView.vue'),
  meta: { requiresAuth: true, title, ...(permission ? { permission } : {}) },
})

// NOTE: the POS shell is listed first so "/" resolves to its redirect child.
const routes = [
  // ---- POS shell (top bar + sidebar) ----
  {
    path: '/',
    component: () => import('@/layouts/PosLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'new-order' } },
      { path: 'reports', name: 'reports', component: () => import('@/views/ReportsView.vue'), meta: { requiresAuth: true, title: 'รายงานภาพรวม', permission: 'report.view' } },
      { path: 'new-order', name: 'new-order', component: () => import('@/views/NewOrderView.vue'), meta: { requiresAuth: true, title: 'New Order', permission: 'purchase.create' } },
      { path: 'orders', name: 'orders', component: () => import('@/views/OrderListView.vue'), meta: { requiresAuth: true, title: 'Orders', permission: 'purchase.read' } },
      { path: 'transport', name: 'transport', component: () => import('@/views/TransportView.vue'), meta: { requiresAuth: true, title: 'การขนส่ง', permission: 'transport.read' } },
      { path: 'no-access', name: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { requiresAuth: true, title: 'ไม่มีสิทธิ์ใช้งาน' } },
      { path: 'system', name: 'system', component: () => import('@/views/SystemSettingsView.vue'), meta: { requiresAuth: true, title: 'จัดแต่งระบบ', permission: ['user.manage', 'role.manage'] } },
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
      { path: 'menu', name: 'menu', ...placeholder('Menu Management', 'settings.manage') },
      { path: 'inventory', name: 'inventory', ...placeholder('Inventory Reports') },
      { path: 'shifts', name: 'shifts', ...placeholder('Shift & Cash Log') },
      { path: 'customers', name: 'customers', ...placeholder('Customer Directory') },
      { path: 'settings', name: 'settings', ...placeholder('Store Settings', 'settings.manage') },
      { path: 'help', name: 'help', ...placeholder('Help Center') },
    ],
  },

  // ---- public ----
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, title: 'Sign in' } },
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
