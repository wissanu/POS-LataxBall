<script setup>
import AppBackground from '@/components/AppBackground.vue'
</script>

<template>
  <div class="auth">
    <AppBackground />
    <router-view />
  </div>
</template>

<style scoped>
.auth { position: relative; min-height: 100%; display: flex; flex-direction: column; }
.auth > :not(.orbs) { position: relative; z-index: 1; }
</style>
