<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import PermissionMatrix from '@/components/PermissionMatrix.vue'
import UserFormModal from '@/components/UserFormModal.vue'
import { adminService } from '@/services/adminService'
import { memberService } from '@/services/memberService'
import { getErrorMessage } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { firstLetter, formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const toast = useToast()

const tab = ref('users') // users | access
const users = ref([])
const roles = ref([])
const catalog = ref([])
const members = ref([])
const loading = ref(true)
const error = ref('')

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    ;[users.value, roles.value, catalog.value, members.value] = await Promise.all([
      adminService.users(), adminService.roles(), adminService.permissions(), memberService.list(),
    ])
  } catch (e) {
    error.value = getErrorMessage(e, 'โหลดข้อมูลไม่สำเร็จ')
  } finally {
    loading.value = false
  }
}
onMounted(loadAll)

const roleName = (code) => roles.value.find((r) => r.code === code)?.name ?? code
const customerLabel = (id) => { const m = members.value.find((x) => x.id === id); return m ? `${m.no} · ${m.name}` : '' }
// a stable colour per user (so the list does not change colour on every render)
const HUES = ['#fecdd3|#9f1239', '#c7d2fe|#3730a3', '#a7f3d0|#065f46', '#bae6fd|#075985', '#ddd6fe|#5b21b6', '#fed7aa|#9a3412', '#99f6e4|#115e59', '#f5d0fe|#86198f']
const hashOf = (v) => [...String(v)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) // ids may be numbers (mock) or UUID strings (real API)
const avatarOf = (u) => { const [bg, fg] = HUES[hashOf(u.id) % HUES.length].split('|'); return { background: bg, color: fg } }

// ================= users tab =================
const q = ref('')
const roleFilter = ref('all')
const shown = computed(() => {
  const term = q.value.trim().toLowerCase()
  return users.value.filter((u) => (roleFilter.value === 'all' || u.role === roleFilter.value)
    && (!term || u.username.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)))
})

const formOpen = ref(false)
const editing = ref(null)
const takenCustomerIds = computed(() => users.value.map((u) => u.customerId).filter(Boolean))
function openCreate() { editing.value = null; formOpen.value = true }
function openEdit(u) { editing.value = u; formOpen.value = true }
async function onSaved(saved, wasEdit) {
  toast.success(wasEdit ? `บันทึก “${saved.username}” แล้ว` : `สร้างผู้ใช้ “${saved.username}” แล้ว`)
  await loadAll()
  if (saved.id === auth.user?.id) await auth.fetchUser() // my own role/permissions may have changed
}

const deleting = ref(null)
const deleteOpen = computed({ get: () => !!deleting.value, set: (v) => { if (!v) deleting.value = null } })
const busy = ref(false)
async function confirmDelete() {
  busy.value = true
  try {
    await adminService.deleteUser(deleting.value.id)
    toast.success(`ลบ “${deleting.value.username}” แล้ว`)
    deleting.value = null
    await loadAll()
  } catch (e) {
    toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ'))
  } finally {
    busy.value = false
  }
}

// ================= access tab =================
const mode = ref('user') // user | role
const targetKey = ref(null) // user id or role code
const draft = ref(new Set())
const saving = ref(false)

const targetUser = computed(() => (mode.value === 'user' ? users.value.find((u) => u.id === targetKey.value) : null))
const targetRole = computed(() => {
  if (mode.value === 'role') return roles.value.find((r) => r.code === targetKey.value)
  return roles.value.find((r) => r.code === targetUser.value?.role)
})
const base = computed(() => new Set(targetRole.value?.permissions ?? []))
const original = computed(() => (mode.value === 'user' ? new Set(targetUser.value?.permissions ?? []) : base.value))
const isAdminTarget = computed(() => targetRole.value?.code === 'ADMIN')
const dirty = computed(() => draft.value.size !== original.value.size || [...draft.value].some((c) => !original.value.has(c)))
const overrideCount = computed(() => (mode.value === 'user' ? [...catalog.value].filter((p) => draft.value.has(p.code) !== base.value.has(p.code)).length : 0))

function resetDraft() { draft.value = new Set(original.value) }
watch([mode, targetKey, users, roles], () => resetDraft(), { flush: 'sync' })
watch([mode, users, roles], () => {
  const list = mode.value === 'user' ? users.value.map((u) => u.id) : roles.value.map((r) => r.code)
  if (!list.includes(targetKey.value)) targetKey.value = list[0] ?? null
}, { immediate: true })

function select(key) {
  if (dirty.value && !window.confirm('มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการทิ้งการเปลี่ยนแปลงหรือไม่?')) return
  targetKey.value = key
}
function switchMode(m) {
  if (m === mode.value) return
  if (dirty.value && !window.confirm('มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการทิ้งการเปลี่ยนแปลงหรือไม่?')) return
  mode.value = m
}
function toggle(code) {
  const next = new Set(draft.value)
  next.has(code) ? next.delete(code) : next.add(code)
  draft.value = next
}
function toggleModule(module, on) {
  const next = new Set(draft.value)
  for (const p of catalog.value.filter((x) => x.module === module)) on ? next.add(p.code) : next.delete(p.code)
  draft.value = next
}
function restoreRoleDefaults() { draft.value = new Set(base.value) }

async function saveAccess() {
  saving.value = true
  try {
    if (mode.value === 'role') {
      await adminService.saveRolePermissions(targetKey.value, [...draft.value])
      toast.success(`บันทึกสิทธิ์ของบทบาท “${targetRole.value.name}” แล้ว`)
    } else {
      const overrides = {}
      for (const p of catalog.value) {
        const on = draft.value.has(p.code)
        if (on !== base.value.has(p.code)) overrides[p.code] = on ? 'GRANT' : 'DENY'
      }
      await adminService.saveUserOverrides(targetKey.value, overrides)
      toast.success(`บันทึกสิทธิ์ของ “${targetUser.value.username}” แล้ว`)
    }
    const key = targetKey.value
    await loadAll()
    targetKey.value = key
    resetDraft()
    await auth.fetchUser() // the signed-in user's own permissions may have changed (sidebar updates immediately)
  } catch (e) {
    toast.error(getErrorMessage(e, 'บันทึกสิทธิ์ไม่สำเร็จ'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="sys glass">
    <header class="head">
      <h1>จัดแต่งระบบ</h1>
      <p>จัดการผู้ใช้ รหัสผ่าน และสิทธิ์การเข้าถึงของแต่ละคน</p>
    </header>

    <div class="tabs" role="tablist" aria-label="หมวดการตั้งค่า">
      <button type="button" role="tab" :aria-selected="tab === 'users'" :class="{ on: tab === 'users' }" @click="tab = 'users'">ผู้ใช้งาน</button>
      <button type="button" role="tab" :aria-selected="tab === 'access'" :class="{ on: tab === 'access' }" @click="tab = 'access'">สิทธิ์การเข้าถึง</button>
    </div>

    <p v-if="loading" class="state">กำลังโหลด…</p>
    <p v-else-if="error" class="state state--error" role="alert">{{ error }} <button type="button" @click="loadAll">ลองใหม่</button></p>

    <!-- ===== users ===== -->
    <template v-else-if="tab === 'users'">
      <div class="bar">
        <label class="search"><AppIcon name="search" :size="15" /><input v-model="q" placeholder="ค้นหาชื่อผู้ใช้หรือชื่อที่แสดง" aria-label="ค้นหาผู้ใช้" /></label>
        <select v-model="roleFilter" class="sel" aria-label="กรองตามบทบาท">
          <option value="all">ทุกบทบาท</option>
          <option v-for="r in roles" :key="r.code" :value="r.code">{{ r.name }}</option>
        </select>
        <BaseButton @click="openCreate"><AppIcon name="plus" :size="14" /> เพิ่มผู้ใช้</BaseButton>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>ผู้ใช้</th><th>บทบาท</th><th>สถานะ</th><th>เข้าระบบล่าสุด</th><th class="r"><span class="sr-only">การทำงาน</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="u in shown" :key="u.id">
              <td>
                <div class="who">
                  <span class="av" :style="avatarOf(u)">{{ firstLetter(u.name) }}</span>
                  <div><b>{{ u.name }}</b><small>{{ u.username }}<template v-if="u.customerId"> · ลูกค้า {{ customerLabel(u.customerId) }}</template></small></div>
                </div>
              </td>
              <td><span class="role" :class="`role--${u.role.toLowerCase()}`">{{ roleName(u.role) }}</span><small v-if="Object.keys(u.overrides ?? {}).length" class="mod">ปรับสิทธิ์เอง {{ Object.keys(u.overrides).length }} รายการ</small></td>
              <td><span class="status" :class="u.active ? 'status--on' : 'status--off'">{{ u.active ? 'ใช้งาน' : 'ปิดใช้งาน' }}</span></td>
              <td class="muted">{{ u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—' }}</td>
              <td class="r">
                <button type="button" class="icon" :aria-label="`แก้ไข ${u.username}`" title="แก้ไข" @click="openEdit(u)"><AppIcon name="edit" :size="15" /></button>
                <button type="button" class="icon icon--danger" :aria-label="`ลบ ${u.username}`" title="ลบ" :disabled="u.id === auth.user?.id" @click="deleting = u"><AppIcon name="trash" :size="15" /></button>
              </td>
            </tr>
            <tr v-if="!shown.length"><td colspan="5" class="state">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== access ===== -->
    <template v-else>
      <div class="bar">
        <div class="seg" role="group" aria-label="กำหนดสิทธิ์ให้">
          <button type="button" :class="{ on: mode === 'user' }" :aria-pressed="mode === 'user'" @click="switchMode('user')">รายบุคคล</button>
          <button type="button" :class="{ on: mode === 'role' }" :aria-pressed="mode === 'role'" @click="switchMode('role')">ตามบทบาท</button>
        </div>
        <p class="hint">{{ mode === 'user' ? 'เริ่มจากสิทธิ์ตามบทบาทของผู้ใช้ แล้วเพิ่มหรือถอดเป็นรายการได้' : 'แก้สิทธิ์พื้นฐานของบทบาท มีผลกับทุกคนในบทบาทนั้น' }}</p>
      </div>

      <div class="access">
        <ul class="targets" :aria-label="mode === 'user' ? 'เลือกผู้ใช้' : 'เลือกบทบาท'">
          <li v-for="t in (mode === 'user' ? users : roles)" :key="mode === 'user' ? t.id : t.code">
            <button type="button" :class="{ on: targetKey === (mode === 'user' ? t.id : t.code) }" :aria-current="targetKey === (mode === 'user' ? t.id : t.code)" @click="select(mode === 'user' ? t.id : t.code)">
              <template v-if="mode === 'user'"><b>{{ t.name }}</b><small>{{ t.username }} · {{ roleName(t.role) }}</small></template>
              <template v-else><b>{{ t.name }}</b><small>{{ t.permissions.length }} สิทธิ์</small></template>
            </button>
          </li>
        </ul>

        <div class="editor">
          <p v-if="isAdminTarget" class="note">ผู้ดูแลระบบ (ADMIN) มีทุกสิทธิ์เสมอ ปรับเปลี่ยนไม่ได้ เพื่อกันไม่ให้ระบบล็อกตัวเอง</p>
          <p v-else-if="mode === 'user' && targetUser" class="note note--info">
            กำลังตั้งสิทธิ์ให้ <b>{{ targetUser.name }}</b> ({{ roleName(targetUser.role) }}) — แถวสีเหลืองคือที่ต่างจากสิทธิ์ตามบทบาท
          </p>
          <PermissionMatrix v-if="targetKey !== null" :catalog="catalog" :granted="isAdminTarget ? new Set(catalog.map((p) => p.code)) : draft" :base="mode === 'user' ? base : null" :readonly="isAdminTarget" @toggle="toggle" @toggle-module="toggleModule" />

          <div v-if="!isAdminTarget && targetKey !== null" class="savebar">
            <span class="muted"><template v-if="mode === 'user'">ต่างจากบทบาท {{ overrideCount }} รายการ</template><template v-else>{{ draft.size }} สิทธิ์ที่เปิด</template></span>
            <BaseButton v-if="mode === 'user' && overrideCount" variant="outline" size="sm" @click="restoreRoleDefaults">คืนค่าตามบทบาท</BaseButton>
            <BaseButton variant="soft" size="sm" :disabled="!dirty" @click="resetDraft">ยกเลิกการแก้ไข</BaseButton>
            <BaseButton size="sm" :disabled="!dirty" :loading="saving" @click="saveAccess">บันทึกสิทธิ์</BaseButton>
          </div>
        </div>
      </div>
    </template>

    <UserFormModal v-model="formOpen" :user="editing" :roles="roles" :members="members" :taken-customer-ids="takenCustomerIds" @saved="onSaved" />

    <BaseModal v-model="deleteOpen" title="ลบผู้ใช้" width="420px">
      <p class="confirm">ต้องการลบ <b>{{ deleting?.name }}</b> ({{ deleting?.username }}) ใช่ไหม? ลบแล้วกู้คืนไม่ได้ ถ้าแค่ต้องการให้เข้าระบบไม่ได้ ให้แก้ไขแล้วปิดใช้งานแทน</p>
      <template #footer>
        <BaseButton variant="soft" @click="deleting = null">ยกเลิก</BaseButton>
        <BaseButton variant="dark" :loading="busy" @click="confirmDelete">ลบผู้ใช้</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.sys { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.head { padding-top: 16px; }
h1 { font-size: 24px; font-weight: 800; letter-spacing: -.4px; color: var(--slate-900); line-height: 32px; }
.head p { font-size: 12px; color: var(--slate-500); }

.tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--slate-200); }
.tabs button { padding: 8px 2px 10px; font-size: 14px; font-weight: 500; color: var(--slate-500); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs button.on { color: var(--blue-600); font-weight: 600; border-color: var(--blue-600); }

.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 9999px; background: rgba(255, 255, 255, .8); border: 1px solid var(--slate-200); color: var(--slate-400); }
.search input { flex: 1; border: 0; background: none; outline: none; font-size: 13px; color: var(--slate-800); }
.sel { height: 38px; padding: 0 12px; border-radius: var(--radius-md); border: 1px solid var(--slate-200); background: rgba(255, 255, 255, .85); font-size: 13px; }
.hint { font-size: 12px; color: var(--slate-500); }

.table-wrap { overflow-x: auto; border-radius: var(--radius-md); background: rgba(255, 255, 255, .8); border: 1px solid #fff; }
table { width: 100%; border-collapse: collapse; min-width: 620px; }
th { text-align: left; font-size: 12px; font-weight: 600; color: var(--slate-500); padding: 12px 14px; border-bottom: 1px solid var(--slate-200); }
td { padding: 11px 14px; border-bottom: 1px solid var(--slate-100); font-size: 13px; vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
.r { text-align: right; white-space: nowrap; }
.who { display: flex; align-items: center; gap: 12px; }
.av { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; flex: none; }
.who b { display: block; font-size: 13px; color: var(--slate-900); }
.who small, .mod { display: block; font-size: 11px; color: var(--slate-500); }
.mod { margin-top: 3px; color: var(--amber-700); }
.muted { font-size: 12px; color: var(--slate-500); }
.role { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: var(--slate-100); color: var(--slate-700); }
.role--admin { background: #ede9fe; color: #5b21b6; }
.role--manager { background: var(--blue-100); color: var(--blue-700); }
.role--cashier { background: var(--green-100); color: var(--green-700); }
.role--customer { background: var(--amber-50); color: var(--amber-700); }
.status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
.status::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.status--on { color: var(--green-700); }
.status--off { color: var(--slate-500); }
.icon { width: 32px; height: 32px; border-radius: 8px; display: inline-grid; place-items: center; color: var(--slate-600); }
.icon:hover:not(:disabled) { background: var(--slate-100); }
.icon--danger:hover:not(:disabled) { background: var(--red-50); color: #dc2626; }
.icon:disabled { opacity: .35; cursor: not-allowed; }

.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: var(--radius-md); background: rgba(255, 255, 255, .75); border: 1px solid var(--slate-200); }
.seg button { padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--slate-600); }
.seg button.on { background: var(--blue-600); color: #fff; box-shadow: var(--shadow-blue); }

.access { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; align-items: start; }
.targets { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; gap: 2px; max-height: 560px; overflow-y: auto; border-radius: var(--radius-md); background: rgba(255, 255, 255, .8); border: 1px solid #fff; }
.targets button { width: 100%; text-align: left; padding: 9px 12px; border-radius: 10px; border: 1px solid transparent; }
.targets button:hover:not(.on) { background: var(--slate-50); }
.targets button.on { background: var(--blue-50); border-color: var(--blue-100); }
.targets b { display: block; font-size: 13px; color: var(--slate-900); }
.targets small { font-size: 11px; color: var(--slate-500); }
.editor { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.note { padding: 10px 12px; border-radius: var(--radius-md); font-size: 12px; background: var(--amber-50); color: var(--amber-700); border: 1px solid #fde68a; }
.note--info { background: var(--blue-50); color: var(--blue-700); border-color: var(--blue-100); }
.savebar { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px; margin-top: 4px; border-radius: var(--radius-md); background: rgba(255, 255, 255, .95); border: 1px solid var(--slate-200); box-shadow: 0 -6px 16px rgba(15, 23, 42, .06); }
.savebar .muted { margin-right: auto; }
.state { text-align: center; color: var(--slate-500); font-size: 13px; padding: 40px 0; }
.state--error { color: #dc2626; }
.state button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
.confirm { font-size: 13px; line-height: 1.6; color: var(--slate-700); }
@media (max-width: 860px) { .access { grid-template-columns: 1fr; } .targets { max-height: 220px; } }
@media (max-width: 700px) { .sys { padding: 16px; } h1 { font-size: 21px; } }
</style>
