import { resolveParams } from '../config/defaults'
import { GRADES, type PricingParams, type ValidationIssue } from '../types'
import { isFiniteNumber } from './math'

const badYield = (y: unknown): boolean => !isFiniteNumber(y) || y <= 0 || y > 1

/** 14. Check parameters (after merging with defaults). Never throws — returns the list of problems (empty = OK). */
export function validateParams(params: Partial<PricingParams> = {}): ValidationIssue[] {
  const p = resolveParams(params)
  const out: ValidationIssue[] = []
  const add = (field: string, message: string) => out.push({ field, message })
  if (!isFiniteNumber(p.factoryPrice) || p.factoryPrice <= 0) add('factoryPrice', 'ราคาโรงงาน (F) ต้องมากกว่า 0')
  if (badYield(p.baseYield)) add('baseYield', 'y พื้นฐานต้องอยู่ระหว่าง 0 ถึง 1')
  for (const g of GRADES) if (badYield(p.gradeYield[g])) add(`gradeYield.${g}`, `y ของเกรด ${g} ต้องอยู่ระหว่าง 0 ถึง 1`)
  if (!isFiniteNumber(p.fixedCostPerDay) || p.fixedCostPerDay < 0) add('fixedCostPerDay', 'ต้นทุนคงที่ต่อวันต้องไม่ติดลบ')
  if (!isFiniteNumber(p.expectedDailyKg) || p.expectedDailyKg <= 0) add('expectedDailyKg', 'ปริมาณรับซื้อที่คาดต่อวันต้องมากกว่า 0')
  if (!isFiniteNumber(p.maxDailyKg) || p.maxDailyKg <= 0) add('maxDailyKg', 'ปริมาณสูงสุดต่อวันต้องมากกว่า 0')
  else if (isFiniteNumber(p.expectedDailyKg) && p.expectedDailyKg > p.maxDailyKg) add('expectedDailyKg', 'ปริมาณที่คาดต่อวันเกินปริมาณสูงสุดต่อวัน')
  if (!isFiniteNumber(p.priceStep) || p.priceStep <= 0) add('priceStep', 'ขั้นการปัดราคาต้องมากกว่า 0')
  if ((p.priceFloor !== null && !isFiniteNumber(p.priceFloor)) || (p.priceCap !== null && !isFiniteNumber(p.priceCap))) add('priceCap', 'ราคาพื้น/เพดานต้องเป็นตัวเลข (หรือเว้นว่าง)')
  else if (p.priceFloor !== null && p.priceCap !== null && p.priceFloor > p.priceCap) add('priceFloor', 'ราคาพื้นต้องไม่สูงกว่าราคาเพดาน')
  if (!isFiniteNumber(p.targetMargin)) add('targetMargin', 'กำไรเป้าหมายต้องเป็นตัวเลข')
  if (p.marketReferencePrice !== null && (!isFiniteNumber(p.marketReferencePrice) || p.marketReferencePrice < 0)) add('marketReferencePrice', 'ราคาตลาดอ้างอิงต้องไม่ติดลบ')
  if (!isFiniteNumber(p.emaAlpha) || p.emaAlpha <= 0 || p.emaAlpha > 1) add('emaAlpha', 'ค่าถ่วง EMA ต้องอยู่ระหว่าง 0 ถึง 1 (ไม่รวม 0)')
  p.wetnessYieldDrop.forEach((d, i) => { if (!isFiniteNumber(d) || d < 0 || d >= 1) add(`wetnessYieldDrop.${i}`, `ค่า y ที่ลดที่ระดับความเปียก ${i} ต้องอยู่ระหว่าง 0 ถึง 1`) })
  return out
}
