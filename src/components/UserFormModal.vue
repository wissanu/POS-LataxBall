<script setup>
import { computed, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import AppIcon from './AppIcon.vue'
import { adminService } from '@/services/adminService'
import { getErrorMessage } from '@/services/http'

const props = defineProps({
  modelValue: Boolean,
  user: { type: Object, default: null },               // null = create
  roles: { type: Array, required: true },
  members: { type: Array, default: () => [] },         // customers that can get a login
  takenCustomerIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const editing = computed(() => !!props.user)
const form = ref({})
const showPassword = ref(false)
const error = ref('')
const saving = ref(false)

watch(() => props.modelValue, (open) => {
  if (!open) return
  error.value = ''
  showPassword.value = false
  form.value = props.user
    ? { username: props.user.username, name: props.user.name, password: '', role: props.user.role, customerId: props.user.customerId, active: props.user.active }
    : { username: '', name: '', password: '', role: 'CASHIER', customerId: null, active: true }
})

const isCustomerRole = computed(() => props.roles.find((r) => r.code === form.value.role)?.isStaff === false)
const freeMembers = computed(() => props.members.filter((m) => !props.takenCustomerIds.includes(m.id) || m.id === props.user?.customerId))

async function save() {
  error.value = ''
  const f = form.value
  if (!editing.value && !f.username.trim()) return (error.value = 'กรุณากรอกชื่อผู้ใช้')
  if (!f.name.trim()) return (error.value = 'กรุณากรอกชื่อที่แสดง')
  if (!editing.value && !f.password) return (error.value = 'กรุณากรอกรหัสผ่าน')
  if (f.password && f.password.length < 6) return (error.value = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
  if (isCustomerRole.value && !f.customerId) return (error.value = 'กรุณาเลือกลูกค้าที่จะผูกกับบัญชีนี้')

  const body = { name: f.name.trim(), role: f.role, active: f.active, ...(isCustomerRole.value ? { customerId: f.customerId } : {}), ...(f.password ? { password: f.password } : {}) }
  saving.value = true
  try {
    const saved = editing.value
      ? await adminService.updateUser(props.user.id, body)
      : await adminService.createUser({ ...body, username: f.username.trim() })
    emit('saved', saved, editing.value)
    emit('update:modelValue', false)
  } catch (e) {
    error.value = getErrorMessage(e, 'บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :model-value="modelValue" :title="editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'" :subtitle="editing ? props.user?.username : 'สร้างชื่อผู้ใช้และรหัสผ่านสำหรับเข้าระบบ'" width="520px" @update:model-value="emit('update:modelValue', $event)">
    <form id="user-form" class="form" novalidate @submit.prevent="save">
      <p v-if="error" class="alert" role="alert">{{ error }}</p>

      <BaseInput v-if="!editing" v-model="form.username" label="ชื่อผู้ใช้ (Username)" icon="id" placeholder="เช่น cashier4" autocomplete="off" size="sm" />
      <BaseInput v-model="form.name" label="ชื่อที่แสดง" icon="user" placeholder="เช่น สมชาย ใจดี" autocomplete="off" size="sm" />
      <BaseInput v-model="form.password" :label="editing ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน'" icon="lock" :type="showPassword ? 'text' : 'password'" placeholder="อย่างน้อย 6 ตัวอักษร" autocomplete="new-password" size="sm">
        <template #trailing>
          <button type="button" class="eye" :aria-label="showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'" @click="showPassword = !showPassword"><AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="16" /></button>
        </template>
      </BaseInput>

      <fieldset class="roles">
        <legend>บทบาท</legend>
        <label v-for="r in roles" :key="r.code" class="role" :class="{ on: form.role === r.code }">
          <input v-model="form.role" type="radio" name="role" :value="r.code" />
          <span><b>{{ r.name }}</b><small>{{ r.description }}</small></span>
        </label>
      </fieldset>

      <label v-if="isCustomerRole" class="select">
        <span>ลูกค้าที่ผูกกับบัญชีนี้</span>
        <select v-model.number="form.customerId">
          <option :value="null" disabled>— เลือกลูกค้า —</option>
          <option v-for="m in freeMembers" :key="m.id" :value="m.id">{{ m.no }} · {{ m.name }}</option>
        </select>
      </label>

      <label class="check"><input v-model="form.active" type="checkbox" /> เปิดใช้งานบัญชีนี้</label>
    </form>

    <template #footer>
      <BaseButton variant="soft" @click="emit('update:modelValue', false)">ยกเลิก</BaseButton>
      <BaseButton type="submit" form="user-form" :loading="saving">{{ editing ? 'บันทึกการแก้ไข' : 'สร้างผู้ใช้' }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.alert { background: var(--red-50); color: var(--red-700); border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 10px 12px; font-size: 12px; font-weight: 500; }
.eye { color: var(--slate-600); display: grid; place-items: center; }
.roles { margin: 0; padding: 0; border: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
legend { font-size: 13px; font-weight: 600; color: var(--slate-800); margin-bottom: 6px; padding: 0; }
.role { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--slate-200); border-radius: var(--radius-md); cursor: pointer; background: rgba(255, 255, 255, .85); }
.role.on { border-color: var(--blue-600); background: var(--blue-50); box-shadow: 0 0 0 3px rgba(37, 99, 235, .1); }
.role input { margin-top: 3px; accent-color: var(--blue-600); }
.role b { display: block; font-size: 13px; color: var(--slate-900); }
.role small { font-size: 11px; color: var(--slate-500); line-height: 1.4; }
.select { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--slate-800); }
.select select { height: 40px; padding: 0 12px; border-radius: var(--radius-md); border: 1px solid var(--slate-200); background: rgba(255, 255, 255, .85); font-size: 14px; font-weight: 400; }
.check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--slate-700); cursor: pointer; }
.check input { width: 16px; height: 16px; accent-color: var(--blue-600); }
@media (max-width: 520px) { .roles { grid-template-columns: 1fr; } }
</style>
