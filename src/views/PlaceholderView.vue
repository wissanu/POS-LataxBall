<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <section class="ph">
    <h1>{{ route.meta.title }}</h1>
    <p>This screen is not designed yet. Add the Figma frame, then replace this view in <code>src/router/index.js</code>.</p>
    <router-link :to="{ name: 'orders' }">Back to orders</router-link>
  </section>
</template>

<style scoped>
.ph { padding: 64px 0; text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: center; }
h1 { font-size: 24px; font-weight: 800; color: var(--slate-900); }
p { color: var(--slate-500); font-size: 13px; max-width: 420px; }
code { background: var(--slate-100); padding: 1px 6px; border-radius: 6px; font-size: 12px; }
a { color: var(--blue-600); font-weight: 600; font-size: 13px; }
</style>
