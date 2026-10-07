import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'

export const useCartStore = defineStore('cart', () => {
  const items = ref([]) // { productId, name, price, qty, note, emoji }
  const serviceType = ref('Dine In')
  const table = ref('Table 07')
  const customer = ref('Sophia Grant')
  const guests = ref(4)
  const productDiscount = ref(0)
  const extraDiscount = ref(0)
  const couponDiscount = ref(0)
  const orderNo = ref(20)

  const subtotal = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0))
  const total = computed(() =>
    Math.max(0, subtotal.value - productDiscount.value - extraDiscount.value - couponDiscount.value),
  )
  const count = computed(() => items.value.reduce((s, i) => s + i.qty, 0))

  function add(product) {
    const found = items.value.find((i) => i.productId === product.id)
    if (found) found.qty++
    else items.value.push({ productId: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1, note: '' })
  }
  function increment(id) { items.value.find((i) => i.productId === id).qty++ }
  function decrement(id) {
    const it = items.value.find((i) => i.productId === id)
    if (it.qty > 1) it.qty--
    else remove(id)
  }
  function remove(id) { items.value = items.value.filter((i) => i.productId !== id) }
  function setNote(id, note) { items.value.find((i) => i.productId === id).note = note.trim() }

  function reset() {
    items.value = []
    productDiscount.value = extraDiscount.value = couponDiscount.value = 0
  }

  /** status: 'pending' (KOT / bill) or 'draft' */
  async function submit(status = 'pending') {
    const order = await orderService.create({
      status,
      customer: customer.value,
      table: table.value,
      serviceType: serviceType.value,
      items: items.value.map(({ productId, name, price, qty, note, emoji }) => ({ id: productId, name, price, qty, note, emoji })),
    })
    orderNo.value = order.id + 1
    reset()
    return order
  }

  return {
    items, serviceType, table, customer, guests, productDiscount, extraDiscount, couponDiscount, orderNo,
    subtotal, total, count, add, increment, decrement, remove, setNote, reset, submit,
  }
})
