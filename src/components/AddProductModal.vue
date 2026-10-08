<script setup>
import { reactive, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import LumpImage from './LumpImage.vue'
import { useProductStore } from '@/stores/products'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { formatNumber, sanitizeDecimal, toNumber } from '@/utils/format'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const products = useProductStore()
const toast = useToast()

const form = reactive({ name: '', price: '' })
const errors = reactive({ name: '', price: '' })
const serverError = ref('')
const busy = ref(false)

// start fresh every time the popup opens
watch(() => props.modelValue, (open) => {
  if (!open) return
  form.name = ''
  form.price = ''
  errors.name = errors.price = serverError.value = ''
})

function validate() {
  errors.name = form.name.trim() ? '' : 'กรุณากรอกชื่อรายการ'
  errors.price = toNumber(form.price) > 0 ? '' : 'กรุณากรอกราคา (มากกว่า 0)'
  return !errors.name && !errors.price
}

async function submit() {
  serverError.value = ''
  if (!validate()) return
  busy.value = true
  try {
    const product = await products.create({ name: form.name.trim(), price: toNumber(form.price) })
    toast.success(`เพิ่ม “${product.name}” แล้ว`)
    emit('update:modelValue', false)
  } catch (e) {
    serverError.value = getErrorMessage(e, 'บันทึกไม่สำเร็จ ลองอีกครั้ง')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" title="เพิ่มรายการสินค้า" subtitle="ตั้งชื่อและราคารับซื้อต่อกิโลกรัม" width="460px" @update:model-value="emit('update:modelValue', $event)">
    <form id="add-product-form" class="form" novalidate @submit.prevent="submit">
      <div class="preview" aria-hidden="true">
        <span class="preview__img"><LumpImage /></span>
        <div>
          <b>{{ form.name.trim() || 'ชื่อสินค้า' }}</b>
          <span><i>{{ formatNumber(toNumber(form.price)) }}</i> บาท / กก.</span>
        </div>
      </div>

      <BaseInput v-model="form.name" label="ชื่อ" icon="box" placeholder="เช่น ก้อนถ้วยยางสด" maxlength="60" autocomplete="off" :error="errors.name" />
      <BaseInput v-model="form.price" label="ราคา" icon="cash" placeholder="0.00" inputmode="decimal" autocomplete="off" :format="sanitizeDecimal" :error="errors.price">
        <template #trailing><span class="unit">บาท / กก.</span></template>
      </BaseInput>

      <p v-if="serverError" class="alert" role="alert">{{ serverError }}</p>
    </form>

    <template #footer>
      <BaseButton variant="soft" size="lg" @click="emit('update:modelValue', false)">ยกเลิก</BaseButton>
      <BaseButton type="submit" form="add-product-form" size="lg" :loading="busy">ยืนยัน</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 16px; }
.preview { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 18px; background: var(--slate-50); border: 1px dashed var(--slate-200); }
.preview__img { width: 76px; height: 58px; flex: none; }
.preview b { display: block; font-size: 14px; line-height: 1.5; color: var(--slate-900); overflow-wrap: anywhere; }
.preview span { font-size: 12px; color: var(--slate-500); }
.preview i { font-style: normal; font-weight: 700; color: var(--blue-600); font-size: 14px; }
.unit { font-size: 12px; font-weight: 500; color: var(--slate-500); white-space: nowrap; }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; line-height: 1.5; }
</style>
