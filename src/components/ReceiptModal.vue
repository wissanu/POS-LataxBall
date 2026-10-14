<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import { renderReceipt } from '@/utils/receipt/renderReceipt'
import { PRINT_DRIVERS, getDriver, printReceipt, setDriver } from '@/services/printService'
import { getErrorMessage } from '@/services/http'
import { useToast } from '@/composables/useToast'

/**
 * หน้าต่างพรีวิวใบเสร็จ + ปุ่มปริ๊น
 *  - ใบที่ยังรอยืนยัน (pending): ปริ๊นสำเร็จ → emit('printed') ให้หน้ารายการยืนยันใบ แล้วถามว่าจะจ่ายเงินไหม
 *    (ถ้ายังไม่มีเครื่องพิมพ์ มีปุ่ม "ยืนยันโดยไม่พิมพ์" → emit('skip'))
 *  - ใบที่ยืนยันแล้ว: พิมพ์ซ้ำ (ใส่ "สำเนา" บนใบเสร็จ) ปิดหน้าต่างเมื่อพิมพ์เสร็จ
 */
const props = defineProps({
  modelValue: Boolean,
  order: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'printed', 'skip'])

const toast = useToast()
const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const confirming = computed(() => props.order?.status === 'pending')

const previewUrl = ref('')
const rendering = ref(false)
const printing = ref(false)
const driver = ref(getDriver())
let canvas = null

watch(() => [props.modelValue, props.order?.id], async ([isOpen]) => {
  if (!isOpen || !props.order) return
  previewUrl.value = ''
  canvas = null
  rendering.value = true
  driver.value = getDriver()
  try {
    const c = await renderReceipt(props.order, { copy: !confirming.value })
    canvas = c
    previewUrl.value = c.toDataURL('image/png')
  } catch (e) {
    toast.error(getErrorMessage(e, 'สร้างตัวอย่างใบเสร็จไม่สำเร็จ'))
  } finally {
    rendering.value = false
  }
}, { immediate: true })

const pickDriver = (id) => { driver.value = id; setDriver(id) }

async function doPrint() {
  if (!canvas || printing.value) return
  printing.value = true
  try {
    await printReceipt(canvas, driver.value)
    if (confirming.value) emit('printed', props.order)
    else { toast.success('ส่งพิมพ์ใบเสร็จแล้ว'); open.value = false }
  } catch (e) {
    toast.error(getErrorMessage(e, 'พิมพ์ไม่สำเร็จ ตรวจสอบเครื่องพิมพ์แล้วลองอีกครั้ง'))
  } finally {
    printing.value = false
  }
}
</script>

<template>
  <BaseModal v-model="open" title="ตัวอย่างใบเสร็จ" :subtitle="order ? `#${order.no}` : ''" width="470px">
    <div class="paper-wrap" :aria-busy="rendering">
      <p v-if="rendering" class="state">กำลังสร้างตัวอย่างใบเสร็จ…</p>
      <img v-else-if="previewUrl" class="paper" :src="previewUrl" alt="ตัวอย่างใบเสร็จ" />
      <p v-else class="state">แสดงตัวอย่างไม่ได้</p>
    </div>

    <div class="driver" role="radiogroup" aria-label="วิธีพิมพ์">
      <span class="driver__lead"><AppIcon name="printer" :size="14" /> วิธีพิมพ์</span>
      <button
        v-for="d in PRINT_DRIVERS" :key="d.id" type="button" role="radio" class="seg" :class="{ on: driver === d.id }"
        :aria-checked="driver === d.id" @click="pickDriver(d.id)"
      >{{ d.label }}</button>
    </div>

    <template #footer>
      <BaseButton v-if="confirming" variant="soft" :disabled="printing" @click="emit('skip', order)">ยืนยันโดยไม่พิมพ์</BaseButton>
      <BaseButton variant="primary" :loading="printing" :disabled="rendering || !previewUrl || printing" @click="doPrint">
        <AppIcon name="printer" :size="15" /> ปริ๊น
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.paper-wrap { max-height: min(56dvh, 560px); overflow: auto; padding: 14px; border-radius: var(--radius-md); background: var(--slate-100); border: 1px solid var(--slate-200); display: flex; justify-content: center; }
.paper { display: block; width: 100%; max-width: 360px; height: auto; background: #fff; box-shadow: 0 2px 10px rgba(15, 23, 42, .18); align-self: flex-start; }
.state { font-size: 13px; color: var(--slate-500); padding: 48px 0; }
.driver { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.driver__lead { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--slate-500); margin-right: 2px; }
.seg { padding: 6px 12px; border-radius: 9999px; border: 1px solid var(--slate-200); background: #fff; font-size: 12px; font-weight: 600; color: var(--slate-600); }
.seg:hover:not(.on) { background: var(--slate-50); }
.seg.on { background: var(--blue-50); border-color: #93c5fd; color: var(--blue-700); font-weight: 700; }
</style>
