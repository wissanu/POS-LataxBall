<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | dark | soft | success | outline
  size: { type: String, default: 'md' },         // sm | md | lg
  block: Boolean,
  loading: Boolean,
  type: { type: String, default: 'button' },
})
</script>

<template>
  <button class="btn" :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]" :type="type" :disabled="loading || undefined">
    <span v-if="loading" class="spin" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: var(--radius-md);
  font-weight: 600; transition: filter .15s, transform .05s; white-space: nowrap; }
.btn:hover:not(:disabled) { filter: brightness(1.05); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn--block { width: 100%; }
.btn--sm { padding: 8px 14px; font-size: 12px; }
.btn--md { padding: 10px 14px; font-size: 12px; font-weight: 700; }
.btn--lg { padding: 14px 16px; font-size: 15px; border-radius: 16px; }
.btn--primary { background: var(--blue-600); color: #fff; box-shadow: var(--shadow-blue); }
.btn--dark { background: var(--slate-900); color: #fff; }
.btn--soft { background: var(--slate-100); color: var(--slate-700); }
.btn--success { background: var(--green-600); color: #fff; }
.btn--outline { background: var(--glass-strong); color: var(--slate-700); border: 1px solid rgba(226, 232, 240, .8);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .05); font-weight: 500; }
.spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .5); border-top-color: #fff; animation: r .7s linear infinite; }
@keyframes r { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2s; } }
</style>
