<script setup>
import BaseModal from './BaseModal.vue'
import ContainerIcon from './ContainerIcon.vue'
import LumpImage from './LumpImage.vue'
import { CONTAINERS } from '@/config/containers'
import { formatNumber } from '@/utils/format'

defineProps({ modelValue: Boolean, product: Object })
const emit = defineEmits(['update:modelValue', 'pick'])

function choose(container) {
  emit('pick', container)
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal :model-value="modelValue" :title="product?.name || ''" width="600px" @update:model-value="emit('update:modelValue', $event)">
    <template #lead><span class="thumb"><LumpImage /></span></template>
    <template #default>
      <p class="sub">
        <b>{{ formatNumber(product?.price) }}</b> บาท / กก. · เลือกภาชนะที่ใส่สินค้า
      </p>
      <div class="grid" role="group" aria-label="เลือกภาชนะ">
        <button v-for="c in CONTAINERS" :key="c.id" type="button" class="opt" @click="choose(c)">
          <span class="opt__icon"><ContainerIcon :container="c" /></span>
          <span class="opt__label">{{ c.label }}</span>
          <small v-if="c.tare">หักภาชนะ {{ formatNumber(c.tare) }} กก.</small>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.thumb { width: 72px; height: 54px; flex: none; }
.sub { margin: -10px 0 18px; font-size: 13px; line-height: 1.5; color: var(--slate-500); }
.sub b { color: var(--blue-600); font-size: 15px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.opt {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 8px 14px; text-align: center;
  background: #fff; border: 1.5px solid var(--slate-200); border-radius: 18px; color: var(--blue-600);
  transition: border-color .15s, background .15s, transform .1s, box-shadow .15s;
}
.opt:hover { border-color: var(--blue-600); background: var(--blue-50); box-shadow: 0 6px 16px -6px rgba(37, 99, 235, .35); }
.opt:active { transform: scale(.97); }
.opt__icon { width: 64px; height: 64px; border-radius: 16px; background: var(--blue-50); display: grid; place-items: center; }
.opt:hover .opt__icon { background: #fff; }
.opt__label { font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--slate-800); }
.opt small { font-size: 11px; color: var(--slate-500); }
@media (max-width: 520px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>
