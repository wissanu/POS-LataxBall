<script setup>
import { ref, computed, watch, nextTick, useId } from 'vue'
import AppIcon from './AppIcon.vue'
import { normalizeSearch } from '@/utils/format'

/**
 * Searchable customer picker (ARIA combobox).
 *  - type a Thai name and/or the customer ID — nothing else is searched
 *  - several words work too: "สมชาย 001" (every word must match the name or the ID)
 *  - ↑ ↓ move, Enter picks, Esc closes, Tab leaves; Thai tone marks are ignored while matching
 */
const props = defineProps({
  modelValue: { type: [Number, String], default: null }, // selected member id
  members: { type: Array, default: () => [] },           // [{ id, no, name }]
  limit: { type: Number, default: 50 },
})
const emit = defineEmits(['update:modelValue'])

const uid = useId()
const listId = `${uid}-list`
const optId = (i) => `${uid}-opt-${i}`
const input = ref(null)
const open = ref(false)
const text = ref('')
const dirty = ref(false) // the user has typed → filter; otherwise show everyone
const active = ref(0)

const selected = computed(() => props.members.find((m) => m.id === props.modelValue) || null)
const labelOf = (m) => `${m.no} · ${m.name}`

function syncFromModel() {
  text.value = selected.value ? labelOf(selected.value) : ''
  dirty.value = false
}
watch([() => props.modelValue, () => props.members], syncFromModel, { immediate: true })

const results = computed(() => {
  const tokens = dirty.value ? normalizeSearch(text.value).split(/\s+/).filter(Boolean) : []
  if (!tokens.length) return props.members
  return props.members.filter((m) => {
    const name = normalizeSearch(m.name)
    const no = normalizeSearch(m.no)
    return tokens.every((t) => name.includes(t) || no.includes(t))
  })
})
const shown = computed(() => results.value.slice(0, props.limit))

function openList() {
  open.value = true
  const i = shown.value.findIndex((m) => m.id === props.modelValue)
  active.value = i >= 0 ? i : 0
}
function onFocus() {
  dirty.value = false
  openList()
  nextTick(() => input.value?.select()) // typing replaces the current choice
}
function onInput() {
  dirty.value = true
  open.value = true
  active.value = 0
}
function close() {
  open.value = false
  syncFromModel() // throw away half-typed text
}
function choose(m) {
  emit('update:modelValue', m.id)
  open.value = false
  dirty.value = false
  input.value?.blur()
}
function clear() {
  emit('update:modelValue', null)
  text.value = ''
  dirty.value = false
  input.value?.focus()
}
function onKeydown(e) {
  const n = shown.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) return openList()
    if (n) active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) return openList()
    if (n) active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    if (open.value && shown.value[active.value]) { e.preventDefault(); choose(shown.value[active.value]) }
  } else if (e.key === 'Escape') {
    if (open.value) { e.preventDefault(); e.stopPropagation(); close() }
  } else if (e.key === 'Tab') {
    close()
  }
}
watch(active, () => nextTick(() => document.getElementById(optId(active.value))?.scrollIntoView?.({ block: 'nearest' })))
</script>

<template>
  <div class="combo">
    <div class="box" :class="{ 'box--open': open }">
      <AppIcon name="search" :size="15" class="box__icon" />
      <input
        ref="input" v-model="text" type="text" role="combobox" autocomplete="off" spellcheck="false"
        placeholder="พิมพ์ชื่อหรือรหัสลูกค้า…" aria-label="ค้นหาลูกค้าประจำ ด้วยชื่อหรือรหัส"
        aria-autocomplete="list" :aria-expanded="open" :aria-controls="listId"
        :aria-activedescendant="open && shown[active] ? optId(active) : undefined"
        @focus="onFocus" @input="onInput" @keydown="onKeydown" @blur="close"
      />
      <button v-if="selected" type="button" class="box__clear" aria-label="ล้างลูกค้าที่เลือก" @mousedown.prevent @click="clear"><AppIcon name="x" :size="14" /></button>
      <AppIcon v-else name="chevron-down" :size="14" class="box__chev" />
    </div>

    <ul v-show="open" :id="listId" class="list" role="listbox" aria-label="รายชื่อลูกค้าประจำ">
      <li
        v-for="(m, i) in shown" :id="optId(i)" :key="m.id" role="option" :aria-selected="m.id === modelValue"
        class="opt" :class="{ 'opt--active': i === active, 'opt--on': m.id === modelValue }"
        @mousedown.prevent @click="choose(m)" @mousemove="active = i"
      >
        <span class="opt__no">{{ m.no }}</span>
        <span class="opt__name">{{ m.name }}</span>
        <AppIcon v-if="m.id === modelValue" name="check" :size="14" class="opt__check" />
      </li>
      <li v-if="!shown.length" class="none" role="presentation">ไม่พบลูกค้า ลองพิมพ์ชื่อหรือรหัสใหม่</li>
      <li v-else-if="results.length > shown.length" class="more" role="presentation">แสดง {{ shown.length }} จาก {{ results.length }} รายการ · พิมพ์เพิ่มเพื่อให้แคบลง</li>
    </ul>
    <p class="sr-only" aria-live="polite">{{ open ? `พบ ${results.length} รายการ` : '' }}</p>
  </div>
</template>

<style scoped>
.combo { position: relative; }
.box { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 10px 0 12px; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); color: var(--slate-400); transition: border-color .15s, box-shadow .15s; }
.box:focus-within, .box--open { border-color: var(--blue-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
.box input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: none; font-size: 13px; font-weight: 500; color: var(--slate-900); }
.box input::placeholder { color: var(--slate-400); font-weight: 400; }
.box__clear { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; color: var(--slate-500); background: var(--slate-100); }
.box__clear:hover { background: #fecaca; color: #dc2626; }
.list {
  position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 30; margin: 0; padding: 6px; list-style: none;
  max-height: 248px; overflow-y: auto; background: #fff; border: 1px solid var(--slate-200); border-radius: 14px; box-shadow: 0 16px 32px -8px rgba(15, 23, 42, .25);
}
.opt { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; cursor: pointer; font-size: 13px; line-height: 1.5; }
.opt--active { background: var(--blue-50); }
.opt__no { flex: none; min-width: 40px; text-align: center; padding: 1px 8px; border-radius: 8px; background: var(--slate-100); color: var(--slate-600); font-size: 12px; font-weight: 700; }
.opt--active .opt__no, .opt--on .opt__no { background: var(--blue-100); color: var(--blue-700); }
.opt__name { flex: 1; min-width: 0; font-weight: 500; color: var(--slate-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.opt__check { color: var(--blue-600); flex: none; }
.none, .more { padding: 12px 10px; font-size: 12px; line-height: 1.5; color: var(--slate-500); text-align: center; }
.more { padding: 8px 10px 4px; font-size: 11px; color: var(--slate-400); }
</style>
