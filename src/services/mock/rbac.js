// Mock users + roles + permissions (mirrors 03_rbac.sql / 05_user_permission_overrides.sql).
// Passwords are stored in plain text HERE ONLY because this is a browser mock — the real API must store a hash.
import { members } from './db'

export const PERMISSIONS = [
  ['customer.read', 'customer', 'ดูข้อมูลลูกค้า'],
  ['customer.create', 'customer', 'เพิ่มลูกค้า'],
  ['customer.update', 'customer', 'แก้ไขข้อมูลลูกค้า'],
  ['customer.delete', 'customer', 'ลบลูกค้า'],
  ['purchase.create', 'purchase', 'เปิดใบรับซื้อ (ขั้น 01)'],
  ['purchase.read', 'purchase', 'ดูใบรับซื้อทั้งหมด'],
  ['purchase.read_own', 'purchase', 'ดูใบรับซื้อของตัวเอง (ลูกค้า)'],
  ['purchase.update', 'purchase', 'แก้ไขใบรับซื้อที่ยังไม่ปิด'],
  ['purchase.confirm', 'purchase', 'ยืนยันการซื้อ (ขั้น 05)'],
  ['purchase.cancel', 'purchase', 'ยกเลิกใบรับซื้อ'],
  ['weighing.create', 'weighing', 'บันทึกการชั่ง'],
  ['weighing.update', 'weighing', 'แก้ไขการชั่ง'],
  ['inspection.create', 'inspection', 'บันทึกผลตรวจเกรด/DRC'],
  ['inspection.update', 'inspection', 'แก้ไขผลตรวจ/ยืนยันเกรดสุดท้าย'],
  ['price.read', 'pricing', 'ดูราคารับซื้อ'],
  ['price.calculate', 'pricing', 'คำนวณราคาใบรับซื้อ'],
  ['price.manage', 'pricing', 'ตั้ง/แก้ประกาศราคา'],
  ['formula.manage', 'pricing', 'จัดการสูตรคิดราคา'],
  ['grade.read', 'pricing', 'ดูเกรดยาง'],
  ['grade.manage', 'pricing', 'จัดการเกรดยาง'],
  ['payment.create', 'payment', 'บันทึกการจ่ายเงิน'],
  ['payment.read', 'payment', 'ดูการจ่ายเงินทั้งหมด'],
  ['payment.read_own', 'payment', 'ดูการจ่ายเงินของตัวเอง (ลูกค้า)'],
  ['payment.void', 'payment', 'ยกเลิกรายการจ่ายเงิน'],
  ['receipt.issue', 'receipt', 'ออกใบรับซื้อ/ปิดรายการ'],
  ['receipt.read', 'receipt', 'ดูใบรับซื้อทั้งหมด'],
  ['receipt.read_own', 'receipt', 'ดูใบรับซื้อของตัวเอง (ลูกค้า)'],
  ['receipt.reprint', 'receipt', 'พิมพ์ซ้ำ'],
  ['report.view', 'report', 'ดูรายงาน'],
  ['report.export', 'report', 'ส่งออกรายงาน'],
  ['user.read', 'admin', 'ดูรายชื่อผู้ใช้'],
  ['user.manage', 'admin', 'เพิ่ม/แก้/ปิดผู้ใช้ และรีเซ็ตรหัส'],
  ['role.manage', 'admin', 'จัดการบทบาทและสิทธิ์'],
  ['audit.view', 'admin', 'ดู audit log และประวัติล็อกอิน'],
  ['settings.read', 'admin', 'ดูการตั้งค่าระบบ'],
  ['settings.manage', 'admin', 'แก้การตั้งค่าระบบ'],
  ['sync.manage', 'admin', 'จัดการการ sync ข้อมูล'],
  ['ml.training_data.export', 'ml', 'ส่งออกข้อมูลสำหรับ retrain'],
  ['ml.model.manage', 'ml', 'จัดการเวอร์ชันโมเดล'],
  ['profile.read_own', 'profile', 'ดูโปรไฟล์ตัวเอง'],
  ['profile.update_own', 'profile', 'แก้โปรไฟล์/เปลี่ยนรหัสผ่านตัวเอง'],
].map(([code, module, name]) => ({ code, module, name }))

export const ROLES = [
  { code: 'ADMIN', name: 'ผู้ดูแลระบบ', level: 100, isStaff: true, description: 'ทำได้ทุกฟังก์ชัน' },
  { code: 'MANAGER', name: 'ผู้จัดการ', level: 70, isStaff: true, description: 'งานของพนักงาน + ราคา ยกเลิก รายงาน' },
  { code: 'CASHIER', name: 'พนักงานรับซื้อ', level: 40, isStaff: true, description: 'งานหน้าร้านขั้น 01–07' },
  { code: 'CUSTOMER', name: 'ลูกค้า', level: 10, isStaff: false, description: 'ดูข้อมูลของตัวเองเท่านั้น' },
]

const CASHIER = [
  'customer.read', 'customer.create', 'purchase.create', 'purchase.read', 'purchase.update', 'purchase.confirm',
  'weighing.create', 'weighing.update', 'inspection.create', 'inspection.update', 'price.read', 'price.calculate',
  'grade.read', 'payment.create', 'payment.read', 'receipt.issue', 'receipt.read', 'receipt.reprint',
  'profile.read_own', 'profile.update_own',
]
const MANAGER = [
  ...CASHIER, 'customer.update', 'purchase.cancel', 'price.manage', 'payment.void',
  'report.view', 'report.export', 'user.read', 'settings.read', 'ml.training_data.export',
]
const CUSTOMER = ['purchase.read_own', 'payment.read_own', 'receipt.read_own', 'price.read', 'profile.read_own', 'profile.update_own']
const ALL = PERMISSIONS.map((p) => p.code)

const DEFAULT_ROLE_PERMISSIONS = { ADMIN: ALL, MANAGER, CASHIER, CUSTOMER }

const USERS_KEY = 'mock.admin.users'
const ROLES_KEY = 'mock.admin.rolePermissions'
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ } }

// ---- roles ----
export const rolePermissions = { ...DEFAULT_ROLE_PERMISSIONS, ...(read(ROLES_KEY) ?? {}), ADMIN: ALL }
export const saveRolePermissions = () => write(ROLES_KEY, rolePermissions)

// ---- users (demo password for everyone: 123456) ----
const u = (id, username, name, role, extra = {}) => ({
  id, username, name, role, password: '123456', active: true, customerId: null, overrides: {}, lastLoginAt: null, ...extra,
})
const seedUsers = () => [
  u(1, 'admin', 'ผู้ดูแลระบบ', 'ADMIN'),
  u(2, 'manager1', 'ผู้จัดการร้าน', 'MANAGER'),
  u(3, 'cashier1', 'พนักงานรับซื้อ 1', 'CASHIER'),
  u(4, 'cashier2', 'พนักงานรับซื้อ 2', 'CASHIER'),
  u(5, 'cashier3', 'พนักงานรับซื้อ 3 (ลาออกแล้ว)', 'CASHIER', { active: false }),
  u(6, '0811112233', members[0].name, 'CUSTOMER', { customerId: members[0].id }),
  u(7, '0822223344', members[1].name, 'CUSTOMER', { customerId: members[1].id }),
  u(8, '0833334455', members[2].name, 'CUSTOMER', { customerId: members[2].id }),
]
export const users = read(USERS_KEY) ?? seedUsers()
export const saveUsers = () => write(USERS_KEY, users)

// ---- helpers ----
export const roleOf = (code) => ROLES.find((r) => r.code === code)

/** role defaults, then per-user GRANT / DENY overrides on top (ADMIN is always everything) */
export function effectivePermissions(user) {
  if (user.role === 'ADMIN') return [...ALL]
  const set = new Set(rolePermissions[user.role] ?? [])
  for (const [code, effect] of Object.entries(user.overrides ?? {})) {
    if (effect === 'GRANT') set.add(code)
    else if (effect === 'DENY') set.delete(code)
  }
  return ALL.filter((c) => set.has(c))
}

export const roleLabel = (code) => roleOf(code)?.name ?? code
