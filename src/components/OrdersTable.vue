<script setup>
import { reactive } from 'vue'
import AppIcon from './AppIcon.vue'
import { formatDateTime, formatMoney, formatNumber, initials } from '@/utils/format'

/**
 * ตารางรายการรับซื้อ — 1 ใบ = 1 แถว สูงเท่ากันทุกแถว (แก้ปัญหาการ์ดสูงไม่เท่ากัน)
 * คลิกแถว/ลูกศรเพื่อขยายดูรายละเอียดรายการ (ชั่งรวม · หักภาชนะ · สุทธิ · ราคา/กก.) ไว้ตรวจสอบ
 */
defineProps({
  orders: { type: Array, required: true },
  busyId: { type: [String, Number], default: null },
  canCancel: Boolean,
})
defineEmits(['accept', 'reject', 'cancel', 'reprint'])

const open = reactive(new Set())
const toggle = (id) => (open.has(id) ? open.delete(id) : open.add(id))

const tones = ['#fecdd3', '#c7d2fe', '#fde68a', '#bbf7d0', '#bae6fd', '#e9d5ff']
const toneOf = (id) => tones[[...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % tones.length]

const totalNet = (o) => o.items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0)
const grades = (o) => [...new Set(o.items.map((it) => it.name.replace(/^เกรด\s*/, '')))]
const container = (it) => String(it.description || '').split('·')[0].trim()
const statusText = { pending: 'PENDING', complete: 'COMPLETE', rejected: 'REJECTED', draft: 'DRAFT' }
</script>

<template>
  <table class="tbl">
    <thead>
      <tr>
        <th class="c-exp" aria-label="ขยาย" />
        <th class="c-no">เลขที่ใบ</th>
        <th class="c-cus">ลูกค้า</th>
        <th class="c-items">เกรด</th>
        <th class="c-num">น้ำหนักสุทธิ</th>
        <th class="c-num">ยอดรวม</th>
        <th class="c-st">สถานะ</th>
        <th class="c-act">ดำเนินการ</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="o in orders" :key="o.id">
        <tr class="row" :class="[`row--${o.status}`, { 'row--open': open.has(o.id) }]" @click="toggle(o.id)">
          <td class="c-exp">
            <button type="button" class="exp" :aria-expanded="open.has(o.id)" :aria-label="`ดูรายละเอียด ${o.no}`" @click.stop="toggle(o.id)">
              <AppIcon name="chevron-right" :size="15" />
            </button>
          </td>
          <td class="c-no"><strong>#{{ o.no }}</strong><time :datetime="o.createdAt">{{ formatDateTime(o.createdAt) }}</time></td>
          <td class="c-cus">
            <span class="avatar" :style="{ background: toneOf(o.id) }" aria-hidden="true">{{ initials(o.customer.name) }}</span>
            <span class="who"><b>{{ o.customer.name }}</b><small v-if="o.customer.memberNo">{{ o.customer.memberNo }}</small><small v-else>ลูกค้าทั่วไป</small></span>
          </td>
          <td class="c-items">
            <span v-for="g in grades(o).slice(0, 3)" :key="g" class="gtag">{{ g }}</span>
            <span v-if="grades(o).length > 3" class="gmore">+{{ grades(o).length - 3 }}</span>
            <small>{{ o.items.length }} รายการ</small>
          </td>
          <td class="c-num">{{ formatNumber(totalNet(o)) }} <small>กก.</small></td>
          <td class="c-num c-total">{{ formatMoney(o.total) }}</td>
          <td class="c-st"><span class="pill" :class="`pill--${o.status}`">{{ statusText[o.status] }}</span></td>
          <td class="c-act" @click.stop>
            <div v-if="o.status === 'pending'" class="acts">
              <button type="button" class="act act--reject" :disabled="busyId === o.id" aria-label="Reject order" title="ปฏิเสธ" @click="$emit('reject', o)"><AppIcon name="x" :size="16" /></button>
              <button type="button" class="act act--accept" :disabled="busyId === o.id" aria-label="ตรวจใบเสร็จและยืนยัน" title="ดูใบเสร็จ / ยืนยัน" @click="$emit('accept', o)"><AppIcon name="check" :size="16" /></button>
            </div>
            <div v-else-if="o.status === 'complete'" class="acts">
              <button v-if="canCancel" type="button" class="cancel" :disabled="busyId === o.id" @click="$emit('cancel', o)">ยกเลิกใบนี้</button>
              <button type="button" class="act act--print" aria-label="พิมพ์ใบเสร็จซ้ำ" title="พิมพ์ใบเสร็จซ้ำ" @click="$emit('reprint', o)"><AppIcon name="printer" :size="16" /></button>
            </div>
            <span v-else class="dash">—</span>
          </td>
        </tr>

        <tr v-if="open.has(o.id)" class="detail">
          <td colspan="8">
            <table class="sub">
              <thead>
                <tr><th>#</th><th>เกรด</th><th>ภาชนะ</th><th class="r">ชั่งรวม (กก.)</th><th class="r">หักภาชนะ</th><th class="r">สุทธิ (กก.)</th><th class="r">ราคา/กก.</th><th class="r">จำนวนเงิน</th></tr>
              </thead>
              <tbody>
                <tr v-for="(it, i) in o.items" :key="i">
                  <td>{{ i + 1 }}</td>
                  <td>{{ it.name }}</td>
                  <td>{{ container(it) || '—' }}</td>
                  <td class="r">{{ it.grossWeight != null ? formatNumber(it.grossWeight) : '—' }}</td>
                  <td class="r">{{ it.tare != null ? formatNumber(it.tare) : '—' }}</td>
                  <td class="r">{{ formatNumber(it.netWeight) }}</td>
                  <td class="r">{{ formatNumber(it.pricePerKg) }}</td>
                  <td class="r"><b>{{ formatMoney(it.price) }}</b></td>
                </tr>
                <tr v-for="(a, i) in o.adjustments" :key="`a${i}`" class="adj">
                  <td colspan="7">{{ a.reason }}</td>
                  <td class="r" :class="a.type === 'ADD' ? 'plus' : 'minus'">{{ a.type === 'ADD' ? '+' : '−' }}{{ formatMoney(a.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<style scoped>
.tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-lg); overflow: clip; }
thead th { position: sticky; top: 0; z-index: 1; background: var(--slate-50); text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .3px; color: var(--slate-500); padding: 10px 12px; border-bottom: 1px solid var(--slate-200); white-space: nowrap; }
td { padding: 10px 12px; border-bottom: 1px solid var(--slate-100); vertical-align: middle; font-size: 13px; color: var(--slate-800); }
tbody tr:last-child td { border-bottom: 0; }
.c-exp { width: 40px; padding-right: 0; }
.c-no { min-width: 190px; }
.c-no strong { display: block; font-size: 13px; font-weight: 700; color: var(--slate-900); white-space: nowrap; }
.c-no time { display: block; font-size: 11px; color: var(--slate-400); }
.c-cus { min-width: 170px; }
.c-cus .avatar { display: inline-grid; place-items: center; width: 32px; height: 32px; margin-right: 10px; border-radius: 50%; font-size: 11px; font-weight: 700; color: var(--slate-800); vertical-align: middle; }
.who { display: inline-flex; flex-direction: column; vertical-align: middle; min-width: 0; }
.who b { font-weight: 600; }
small { font-size: 11px; color: var(--slate-400); font-weight: 500; }
.c-items { white-space: nowrap; }
.gtag { display: inline-block; margin-right: 4px; padding: 2px 9px; border-radius: 9999px; background: var(--blue-50); color: var(--blue-700); font-size: 12px; font-weight: 700; }
.gmore { font-size: 12px; font-weight: 700; color: var(--slate-500); margin-right: 6px; }
.c-items small { margin-left: 4px; }
th.c-num, td.c-num { text-align: right; white-space: nowrap; }
.c-total { font-weight: 800; font-size: 14px; color: var(--slate-900); }
.c-st { width: 110px; }
.c-act { width: 150px; }

.row { cursor: pointer; transition: background .12s; }
.row:hover { background: var(--slate-50); }
.row--pending { background: #fffdf5; }
.row--pending:hover { background: var(--amber-50); }
.row--open td { border-bottom-color: transparent; }
.exp { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--slate-400); transition: transform .15s, background .15s; }
.exp:hover { background: var(--slate-100); color: var(--slate-700); }
.exp[aria-expanded='true'] { transform: rotate(90deg); color: var(--blue-700); }
@media (prefers-reduced-motion: reduce) { .exp { transition: none; } }

.pill { display: inline-block; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; border: 1px solid; white-space: nowrap; }
.pill--pending { background: var(--amber-50); color: var(--amber-700); border-color: #fcd34d; }
.pill--complete { background: #f0fdf4; color: var(--green-700); border-color: #86efac; }
.pill--rejected { background: var(--red-50); color: var(--red-700); border-color: #fecaca; }
.pill--draft { background: var(--slate-50); color: var(--slate-600); border-color: var(--slate-200); }

.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.dash { display: block; text-align: right; color: var(--slate-300); }
.act { width: 34px; height: 34px; border-radius: var(--radius-md); display: grid; place-items: center; background: #fff; border: 1px solid; transition: background .15s, color .15s; }
.act--reject { border-color: #fecaca; color: #dc2626; }
.act--reject:hover:not(:disabled) { background: #dc2626; color: #fff; }
.act--accept { border-color: #86efac; color: var(--green-600); }
.act--accept:hover:not(:disabled) { background: var(--green-600); color: #fff; }
.act--print { border-color: var(--slate-200); color: var(--slate-600); }
.act--print:hover { background: var(--slate-100); }
.act:disabled { opacity: .5; cursor: not-allowed; }
.cancel { font-size: 11px; font-weight: 600; color: var(--slate-500); padding: 6px 8px; border-radius: var(--radius-sm); text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
.cancel:hover:not(:disabled) { color: #dc2626; background: var(--red-50); }
.cancel:disabled { opacity: .5; cursor: not-allowed; }

.detail td { padding: 0 12px 14px 52px; background: var(--slate-50); border-bottom: 1px solid var(--slate-100); }
.row--open + .detail td { background: var(--slate-50); }
.sub { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--slate-200); border-radius: var(--radius-md); overflow: hidden; }
.sub th { position: static; background: #fff; font-size: 11px; color: var(--slate-500); padding: 8px 10px; border-bottom: 1px solid var(--slate-200); }
.sub td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid var(--slate-100); background: #fff; }
.sub tr:last-child td { border-bottom: 0; }
.sub .r { text-align: right; }
.adj td { color: var(--slate-600); font-size: 12px; }
.plus { color: var(--green-700); font-weight: 700; }
.minus { color: var(--red-700); font-weight: 700; }

@media (max-width: 900px) { .c-items { display: none; } thead th.c-items { display: none; } }
</style>
