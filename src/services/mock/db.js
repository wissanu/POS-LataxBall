const ago = (min) => new Date(Date.now() - min * 60000).toISOString()

// Demo accounts — every PIN is 1234
export const users = [
  { id: 1, cashierId: 'CASHIER-802', name: 'Sophia Grant', email: 'sophia.grant@eatspace.io', pin: '1234', role: 'manager', title: 'Table Lead', store: 'Eatspace Artisan Bistro', terminal: 'Terminal 01' },
  { id: 2, cashierId: 'CASHIER-417', name: 'Liam Foster', email: 'liam.foster@eatspace.io', pin: '1234', role: 'cashier', title: 'Active Cashier', store: 'Eatspace Artisan Bistro', terminal: 'Terminal 01' },
  { id: 3, cashierId: 'CASHIER-233', name: 'Emma Clarke', email: 'emma.clarke@eatspace.io', pin: '1234', role: 'cashier', title: 'Floor Host', store: 'Eatspace Artisan Bistro', terminal: 'Terminal 01' },
]

export const categories = ['Rice', 'Beverages', 'Salads', 'Soup', 'Pizza', 'Desserts']

export const products = [
  { id: 1, name: 'Chicken Burger', description: 'Crispy patty & cheese', price: 10, emoji: '🍔', tag: 'Fast Food', tagTone: 'blue', category: 'Rice', brand: 'House' },
  { id: 2, name: 'Onion Rings', description: 'Golden fried & crispy', price: 10, emoji: '🧅', tag: 'Appetizer', tagTone: 'amber', category: 'Soup', brand: 'House' },
  { id: 3, name: 'Fresh Basil Salad', description: 'Olive oil & feta', price: 10, emoji: '🥗', tag: 'Healthy', tagTone: 'green', category: 'Salads', brand: 'Local Farm' },
  { id: 4, name: 'Smoked Bacon', description: 'Wood-fired strips', price: 10, emoji: '🥓', tag: 'Sides', tagTone: 'rose', category: 'Rice', brand: 'House' },
  { id: 5, name: 'Fresh Tomatoes', description: 'Farm fresh sliced', price: 10, emoji: '🍅', tag: 'Fresh', tagTone: 'red', category: 'Salads', brand: 'Local Farm' },
  { id: 6, name: 'Beef Burger', description: 'Double patty & bacon', price: 10, emoji: '🍔', tag: 'Special', tagTone: 'blue', category: 'Rice', brand: 'House' },
  { id: 7, name: 'Vegetable Pizza', description: 'Mozzarella & peppers', price: 10, emoji: '🍕', tag: 'Pizza', tagTone: 'purple', category: 'Pizza', brand: 'House' },
  { id: 8, name: 'Fish & Chips', description: 'Crispy batter & fries', price: 10, emoji: '🍟', tag: 'Seafood', tagTone: 'sky', category: 'Rice', brand: 'Harbor' },
  { id: 9, name: 'Egg Benedict', description: 'Hollandaise & ham', price: 10.5, emoji: '🍳', tag: 'Brunch', tagTone: 'amber', category: 'Rice', brand: 'House' },
  { id: 10, name: 'Iced Latte', description: 'Double shot, oat milk', price: 4.5, emoji: '🧋', tag: 'Cold', tagTone: 'sky', category: 'Beverages', brand: 'Harbor' },
  { id: 11, name: 'Tomato Soup', description: 'Roasted & creamy', price: 6, emoji: '🍲', tag: 'Warm', tagTone: 'red', category: 'Soup', brand: 'Local Farm' },
  { id: 12, name: 'Chocolate Cake', description: 'Dark, with ganache', price: 7.5, emoji: '🍰', tag: 'Sweet', tagTone: 'purple', category: 'Desserts', brand: 'House' },
]

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
