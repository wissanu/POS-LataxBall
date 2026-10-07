<template>
  <main class="nf">
    <h1>404</h1>
    <p>That page doesn’t exist.</p>
    <router-link to="/">Go to the register</router-link>
  </main>
</template>

<style scoped>
.nf { min-height: 100%; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; }
h1 { font-size: 64px; font-weight: 800; color: var(--blue-600); }
p { color: var(--slate-600); }
a { color: var(--blue-600); font-weight: 600; margin-top: 8px; }
</style>
