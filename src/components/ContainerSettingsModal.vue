<script setup>
import { reactive, ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import ContainerIcon from './ContainerIcon.vue'
import AppIcon from './AppIcon.vue'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/services/http'
import { sanitizeDecimal, toNumber, round2 } from '@/utils/format'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const settings = useSettingsStore()
const toast = useToast()

const draft = reactive({}) // containerId -> text in the field
const busy = ref(false)
const serverError = ref('')

watch(() => props.modelValue, (open) => {
  if (!open) return
  serverError.value = ''
  settings.containers.forEach((c) => { draft[c.id] = String(c.tare ?? 0) })
})

const valueOf = (c) => round2(toNumber(draft[c.id]))
// only the numbers that actually changed (and are not locked) are sent
const changes = computed(() =>
  Object.fromEntries(settings.containers.filter((c) => !c.fixed && valueOf(c) !== c.tare).map((c) => [c.id, valueOf(c)])),
)
const dirty = computed(() => Object.keys(changes.value).length > 0)
const isChanged = (c) => c.id in changes.value
const preview = computed(() => JSON.stringify({ containers: Object.entries(changes.value).map(([id, tare]) => ({ id, tare })) }, null, 2))

async function save() {
  if (!dirty.value || busy.value) return
  busy.value = true
  serverError.value = ''
  try {
    await settings.saveTares(changes.value)
    toast.success('บันทึกน้ำหนักภาชนะแล้ว')
    emit('update:modelValue', false)
  } catch (e) {
    serverError.value = getErrorMessage(e, 'บันทึกไม่สำเร็จ ลองอีกครั้ง')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" title="ตั้งค่าน้ำหนักภาชนะ" subtitle="น้ำหนักที่ระบบหักออกจากน้ำหนักรวมให้อัตโนมัติ (หน่วย กก.)" width="540px" @update:model-value="emit('update:modelValue', $event)">
    <form id="container-settings-form" class="list" novalidate @submit.prevent="save">
      <div v-for="c in settings.containers" :key="c.id" class="row" :class="{ 'row--changed': isChanged(c), 'row--fixed': c.fixed }">
        <span class="row__icon"><ContainerIcon :container="c" :size="34" /></span>
        <label :for="`tare-${c.id}`" class="row__label">
          {{ c.label }}
          <small v-if="c.fixed"><AppIcon name="lock" :size="11" /> ค่าคงที่ แก้ไขไม่ได้</small>
          <small v-else-if="isChanged(c)" class="changed">แก้ไขแล้ว · ค่าเดิม {{ c.tare }} กก.</small>
        </label>
        <span class="field">
          <input
            :id="`tare-${c.id}`" v-model="draft[c.id]" inputmode="decimal" maxlength="7" autocomplete="off" :disabled="c.fixed"
            @input="draft[c.id] = sanitizeDecimal($event.target.value); $event.target.value = draft[c.id]"
          />
          <em>กก.</em>
        </span>
      </div>

      <p v-if="serverError" class="alert" role="alert">{{ serverError }}</p>

      <details class="json">
        <summary>ดูข้อมูล JSON ที่จะบันทึก</summary>
        <pre>{{ dirty ? preview : '// ยังไม่มีการแก้ไข' }}</pre>
      </details>
      <p class="note">แก้ไขได้เฉพาะตัวเลข ไม่สามารถเพิ่มหรือลบภาชนะจากหน้านี้</p>
    </form>

    <template #footer>
      <BaseButton variant="soft" size="lg" @click="emit('update:modelValue', false)">ยกเลิก</BaseButton>
      <BaseButton type="submit" form="container-settings-form" size="lg" :loading="busy" :disabled="!dirty">บันทึก</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1.5px solid var(--slate-100); border-radius: 16px; background: #fff; transition: border-color .15s, background .15s; }
.row--changed { border-color: #93c5fd; background: var(--blue-50); }
.row--fixed { background: var(--slate-50); }
.row__icon { width: 48px; height: 48px; flex: none; border-radius: 12px; background: var(--blue-50); color: var(--blue-600); display: grid; place-items: center; }
.row--changed .row__icon { background: #fff; }
.row__label { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 14px; font-weight: 600; line-height: 1.5; color: var(--slate-800); }
.row__label small { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; color: var(--slate-500); }
.row__label small.changed { color: var(--blue-700); }
.field { position: relative; width: 132px; flex: none; }
.field input { width: 100%; height: 42px; padding: 0 40px 0 12px; text-align: right; font-size: 16px; font-weight: 700; color: var(--slate-900); background: #fff; border: 1px solid var(--slate-200); border-radius: 12px; outline: none; }
.field input:focus { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.field input:disabled { background: var(--slate-100); color: var(--slate-400); }
.field em { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 12px; color: var(--slate-400); pointer-events: none; }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; line-height: 1.5; }
.json { margin-top: 4px; font-size: 12px; color: var(--slate-500); }
.json summary { cursor: pointer; padding: 4px 0; font-weight: 600; }
.json pre { margin: 6px 0 0; padding: 10px 12px; background: var(--slate-900); color: #e2e8f0; border-radius: 12px; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; overflow: auto; max-height: 160px; }
.note { font-size: 11px; line-height: 1.5; color: var(--slate-400); }
@media (max-width: 520px) { .field { width: 110px; } .row__icon { display: none; } }
</style>
