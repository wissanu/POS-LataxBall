<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ProductCard from '@/components/ProductCard.vue'
import OrderPanel from '@/components/OrderPanel.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useProductStore } from '@/stores/products'
import { useCartStore } from '@/stores/cart'
import { useOrderStore } from '@/stores/orders'
import { useToast } from '@/composables/useToast'

const products = useProductStore()
const cart = useCartStore()
const orders = useOrderStore()
const toast = useToast()
const router = useRouter()

onMounted(() => { if (!products.items.length) products.load() })

function openDrafts() {
  orders.statusFilter = 'draft'
  router.push({ name: 'orders' })
}
</script>

<template>
  <section class="center glass">
    <header class="title">
      <div class="title__row">
        <h1>Point of Sale (POS)</h1>
        <span class="live">Live</span>
      </div>
      <p class="crumbs">Dashboard <i>•</i> <b>New Order</b></p>
      <div class="quick">
        <BaseButton size="sm" @click="cart.reset()"><AppIcon name="plus" :size="14" /> New</BaseButton>
        <BaseButton variant="outline" size="sm" @click="toast.info('No QR menu orders waiting.')"><AppIcon name="qr" :size="14" /> QR Menu Orders</BaseButton>
        <BaseButton variant="outline" size="sm" @click="openDrafts"><AppIcon name="file" :size="14" /> Draft List</BaseButton>
        <BaseButton variant="outline" size="sm" @click="cart.serviceType = 'Dine In'"><AppIcon name="table" :size="14" /> Table Order</BaseButton>
      </div>
    </header>

    <div class="filters">
      <label class="search">
        <AppIcon name="search" />
        <input v-model="products.filters.search" placeholder="Search in products..." />
      </label>
      <label class="select select--cat">
        <span class="sr-only">Category</span>
        <select v-model="products.filters.category">
          <option value="">All Category</option>
          <option v-for="c in products.categories" :key="c" :value="c">{{ c }}</option>
        </select>
        <AppIcon name="chevron-down" :size="16" />
      </label>
      <label class="select select--brand">
        <span class="sr-only">Brand</span>
        <select v-model="products.filters.brand">
          <option value="">Select Brand</option>
          <option v-for="b in products.brands" :key="b" :value="b">{{ b }}</option>
        </select>
        <AppIcon name="chevron-down" :size="16" />
      </label>
    </div>

    <div class="chips" role="group" aria-label="Category">
      <button type="button" :class="{ on: !products.filters.category }" @click="products.filters.category = ''">Show All</button>
      <button v-for="c in products.categories" :key="c" type="button" :class="{ on: products.filters.category === c }" @click="products.filters.category = c">{{ c }}</button>
    </div>

    <div class="grid scroll-y">
      <p v-if="products.loading" class="state">Loading menu…</p>
      <p v-else-if="products.error" class="state state--error">{{ products.error }} <button type="button" @click="products.load()">Retry</button></p>
      <p v-else-if="!products.visible.length" class="state">No dishes match your filters.</p>
      <template v-else>
        <ProductCard v-for="p in products.visible" :key="p.id" :product="p" @add="cart.add" />
      </template>
    </div>
  </section>

  <OrderPanel />
</template>

<style scoped>
.center { flex: 1; min-width: 0; padding: 21px; display: flex; flex-direction: column; }
.title { padding-bottom: 17px; border-bottom: 1px solid rgba(226, 232, 240, .6); display: flex; flex-direction: column; gap: 12px; }
.title__row { display: flex; align-items: center; gap: 8px; }
h1 { font-size: 18px; font-weight: 700; letter-spacing: -.45px; color: var(--slate-900); line-height: 28px; }
.live { background: var(--green-100); color: var(--green-700); font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; }
.crumbs { font-size: 12px; color: var(--slate-400); margin-top: -10px; }
.crumbs i { font-style: normal; margin: 0 4px; }
.crumbs b { color: var(--blue-600); font-weight: 500; }
.quick { display: flex; flex-wrap: wrap; gap: 8px; }
.filters { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 0; }
.search { flex: 1; min-width: 200px; display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 12px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); box-shadow: 0 1px 2px rgba(0, 0, 0, .05); color: var(--slate-400); }
.search input { flex: 1; border: 0; outline: none; background: none; font-size: 12px; color: var(--slate-800); }
.select { position: relative; display: flex; align-items: center; height: 34px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); color: var(--slate-500); }
.select--cat { width: 160px; } .select--brand { width: 144px; }
.select select { appearance: none; width: 100%; height: 100%; border: 0; background: none; outline: none; padding: 0 30px 0 13px; font-size: 12px; font-weight: 500; color: var(--slate-700); cursor: pointer; }
.select svg { position: absolute; right: 9px; pointer-events: none; }
.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; }
.chips button { flex: none; padding: 7px 17px; border-radius: var(--radius-md); background: var(--glass-strong); border: 1px solid rgba(226, 232, 240, .8); font-size: 12px; font-weight: 500; color: var(--slate-600); }
.chips button.on { background: var(--blue-600); border-color: var(--blue-600); color: #fff; font-weight: 600; box-shadow: 0 1px 1px rgba(59, 130, 246, .2); }
.grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(134px, 1fr)); gap: 14px; align-content: start; padding: 0 4px 16px 0; }
.state { grid-column: 1 / -1; text-align: center; color: var(--slate-500); font-size: 13px; padding: 48px 0; }
.state--error { color: #dc2626; }
.state button { color: var(--blue-600); font-weight: 600; margin-left: 8px; }
</style>
