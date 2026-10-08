<script setup>
import { computed } from 'vue'
import { ICONS, basketTransform } from '@/config/containerIcons'

const props = defineProps({ container: { type: Object, required: true }, size: { type: Number, default: 44 } })

const inner = computed(() =>
  props.container.icon === 'basket'
    ? `<g transform="${basketTransform(props.container.scale ?? 1)}">${ICONS.basket}</g>`
    : ICONS[props.container.icon] || ICONS.none,
)
</script>

<template>
  <svg
    :width="size" :height="size" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="inner"
  />
</template>
