<script setup>
import { ref, watch, nextTick, onBeforeUnmount, useId } from 'vue'
import AppIcon from './AppIcon.vue'

/**
 * Popup panel: everything behind it is blurred, ปุ่มปิดสีแดงอยู่มุมขวาบน
 * Esc / คลิกพื้นหลัง / ปุ่มแดง = ปิด · focus ถูกล็อกไว้ใน panel แล้วคืนให้ปุ่มเดิมตอนปิด
 */
const props = defineProps({
  modelValue: Boolean,
  title: { type: String, required: true },
  subtitle: String,
  width: { type: String, default: '480px' },
})
const emit = defineEmits(['update:modelValue'])

const titleId = useId()
const panel = ref(null)
let opener = null

const close = () => emit('update:modelValue', false)
const focusables = () =>
  [...(panel.value?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]') ?? [])]

function onKeydown(e) {
  if (e.key === 'Escape') { e.stopPropagation(); close(); return }
  if (e.key !== 'Tab') return
  const els = focusables()
  if (!els.length) return
  const first = els[0]
  const last = els[els.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

function release() {
  document.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
}

watch(() => props.modelValue, async (open) => {
  if (!open) return release()
  opener = document.activeElement
  document.addEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = 'hidden' // no page scroll behind the popup
  await nextTick()
  ;(focusables()[0] ?? panel.value)?.focus()
})

// give focus back to what opened the popup — unless something else (e.g. the weight field) already took it
function afterLeave() {
  const a = document.activeElement
  if (!a || a === document.body) opener?.focus?.()
  opener = null
}

onBeforeUnmount(release)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-leave="afterLeave">
      <div v-if="modelValue" class="backdrop" @pointerdown.self="close">
        <section ref="panel" class="panel" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" :style="{ '--w': width }">
          <header class="head">
            <slot name="lead" />
            <div>
              <h2 :id="titleId">{{ title }}</h2>
              <p v-if="subtitle">{{ subtitle }}</p>
            </div>
          </header>

          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>

          <!-- last in DOM so the first form field gets focus; positioned top-right with CSS -->
          <button type="button" class="close" aria-label="ปิด" @click="close"><AppIcon name="x" :size="18" /></button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; overflow: auto;
  background: rgba(15, 23, 42, .38);
  backdrop-filter: blur(10px) saturate(1.1); -webkit-backdrop-filter: blur(10px) saturate(1.1);
}
.panel {
  position: relative; width: min(var(--w), 100%); max-height: calc(100dvh - 48px); overflow: auto; outline: none;
  background: rgba(255, 255, 255, .97); border: 1px solid #fff; border-radius: 28px; padding: 28px;
  box-shadow: 0 30px 60px -12px rgba(15, 23, 42, .35);
}
.head { display: flex; align-items: center; gap: 14px; padding-right: 44px; margin-bottom: 20px; }
h2 { font-size: 20px; font-weight: 700; line-height: 1.4; color: var(--slate-900); }
.head p { font-size: 13px; line-height: 1.5; color: var(--slate-500); }
.foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }

.close {
  position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center; color: #dc2626; background: var(--red-50); border: 1px solid #fecaca;
  transition: background .15s, color .15s;
}
.close:hover { background: #dc2626; color: #fff; }

.modal-enter-active, .modal-leave-active { transition: opacity .18s ease; }
.modal-enter-active .panel, .modal-leave-active .panel { transition: transform .2s cubic-bezier(.2, .8, .2, 1), opacity .18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .panel, .modal-leave-to .panel { transform: translateY(10px) scale(.97); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .modal-enter-active, .modal-leave-active, .modal-enter-active .panel, .modal-leave-active .panel { transition: none; }
}
@media (max-width: 520px) { .panel { padding: 22px 18px; border-radius: 22px; } }
</style>
