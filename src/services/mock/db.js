const ago = (min) => new Date(Date.now() - min * 60000).toISOString()

// Demo accounts — every PIN is 1234
export const users = [
  { id: 1, cashierId: 'CASHIER-802', name: 'Sophia Grant', email: 'sophia.grant@eatspace.io', pin: '1234', role: 'manager', title: 'Table Lead', store: 'Eatspace Artisan Bistro', terminal: 'Terminal 01' },
  { id: 2, cashierId: 'CASHIER-417', name: 'Liam Foster', email: 'liam.foster@eatspace.io', pin: '1234', role: 'cashier', title: 'Active Cashier', store: 'Eatspace Artisan Bistro', terminal: 'Terminal 01' },
  { id: 3, cashierId: 'CASHIER-233', name: 'Emma Clarke', email: 'emma.clarke@eatspace.io', pin: '1234', role: 'cashier', title: 'Floor Host', store: 'Eatspace Artisan Bistro', terminal: 'Terminal 01' },
]

export const categories = []

// สมาชิก (ลูกค้าประจำ) — ข้อมูลตัวอย่างสำหรับทดสอบเท่านั้น
export const members = [
  { id: 1, no: '001', name: 'สมชาย ใจดี' },
  { id: 2, no: '002', name: 'สมศรี รักสวน' },
  { id: 3, no: '003', name: 'ประเสริฐ ทองดี' },
  { id: 4, no: '004', name: 'วิไล แสงจันทร์' },
  { id: 5, no: '005', name: 'บุญเลี้ยง สุขสบาย' },
]

// รายการสินค้า: เริ่มต้นว่าง และเก็บใน localStorage เพื่อให้รีเฟรชแล้วไม่หาย (เฉพาะโหมด mock)
const PRODUCTS_KEY = 'mock.products'
const loadProducts = () => {
  try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) ?? [] } catch { return [] }
}
export const products = loadProducts() // { id, name, price }  price = บาท/กก.
export const saveProducts = () => {
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)) } catch { /* ignore */ }
}

const item = (id, name, price, emoji, description = 'Fresh Prawn Mix salad') => ({ id, name, price, qty: 1, emoji, description })

export const orders = [
  { id: 345, createdAt: ago(5), customer: { name: 'Mia Collins' }, extraItems: 2, total: 10.6, status: 'pending',
    items: [item(1, 'Prawn Mix Salad', 5.3, '🥗'), item(2, 'Prawn Mix Salad', 30, '🥗')] },
  { id: 346, createdAt: ago(9), customer: { name: 'Ava Brooks' }, extraItems: 2, total: 10.6, status: 'rejected',
    items: [item(3, 'Beef Shawarma', 7.4, '🌯'), item(4, 'Chicken Nuggets', 40, '🍗')] },
  { id: 347, createdAt: ago(14), customer: { name: 'Noah Reed' }, extraItems: 2, total: 10.6, status: 'complete',
    items: [item(5, 'Fruit Bowl Mix', 80, '🍓'), item(6, 'Oatmeal Delight', 100, '🥣')] },
  { id: 348, createdAt: ago(21), customer: { name: 'Ethan Cole' }, extraItems: 2, total: 10.6, status: 'pending',
    items: [item(7, 'Strawberry Shake', 5.3, '🥤'), item(8, 'Donut Bites', 5.3, '🍩')] },
  { id: 349, createdAt: ago(30), customer: { name: 'Lucas Ward' }, extraItems: 2, total: 10.6, status: 'pending',
    items: [item(9, 'Grilled Sandwich', 50, '🥪'), item(10, 'Mixed Vegetable Curry', 100, '🍛')] },
  { id: 350, createdAt: ago(44), customer: { name: 'Zoe Hart' }, extraItems: 2, total: 10.6, status: 'complete',
    items: [item(11, 'Fresh Green Salad', 30, '🥬'), item(12, 'Avocado Toast', 5.3, '🥑')] },
]

// Status chips above the order grid (design shows ids of recent tickets)
const chipIds = [
  [456, 'complete'], [723, 'complete'], [184, 'rejected'], [936, 'complete'],
  [523, 'complete'], [348, 'pending'], [269, 'complete'], [453, 'complete'],
]
export const queueOf = (list) =>
  chipIds.map(([id, status]) => ({ id, status: list.find((o) => o.id === id)?.status || status }))
