<script setup>
import { toasts } from '@/composables/useToast'
</script>

<template>
  <router-view />
  <div class="toast-host" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.tone}`" role="status">{{ t.message }}</div>
  </div>
</template>

<style>
.toast-host { position: fixed; right: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
.toast {
  padding: 10px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #fff;
  background: var(--slate-900); box-shadow: var(--shadow-panel); animation: toast-in .2s ease-out;
}
.toast--success { background: var(--green-600); }
.toast--error { background: #dc2626; }
@keyframes toast-in { from { transform: translateY(8px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
</style>
