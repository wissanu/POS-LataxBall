import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { productService } from '@/services/productService'
import { getErrorMessage } from '@/services/http'

export const useProductStore = defineStore('products', () => {
  const items = ref([])
  const categories = ref([])
  const loading = ref(false)
  const error = ref('')
  const filters = ref({ search: '', category: '', brand: '' })

  const brands = computed(() => [...new Set(items.value.map((p) => p.brand))].sort())

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const [list, cats] = await Promise.all([productService.list(), productService.categories()])
      items.value = list
      categories.value = cats
    } catch (e) {
      error.value = getErrorMessage(e, 'Could not load the menu.')
    } finally {
      loading.value = false
    }
  }

  /** { name, price } — price is บาท/กก. */
  async function create(payload) {
    const product = await productService.create(payload)
    items.value.push(product)
    return product
  }

  // Filtering happens client-side for snappy POS taps; swap to server params when the menu gets large.
  const visible = computed(() => {
    const { search, category, brand } = filters.value
    const q = search.trim().toLowerCase()
    return items.value.filter(
      (p) =>
        (!category || p.category === category) &&
        (!brand || p.brand === brand) &&
        (!q || p.name.toLowerCase().includes(q)),
    )
  })

  return { items, categories, brands, loading, error, filters, visible, load, create }
})
