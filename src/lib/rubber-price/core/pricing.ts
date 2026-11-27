import { resolveParams } from '../config/defaults'
import {
  GRADES,
  type GradePriceRow,
  type MarketComparison,
  type PriceBoard,
  type PriceBoardRow,
  type PriceSuggestion,
  type PriceWarning,
  type MarginStatus,
  type PricingParams,
  type QuoteRange,
  type RequiredFactoryPrice,
  type WetnessLevel,
} from '../types'
import { clamp, isFiniteNumber, round2, roundDownToStep } from './math'

type P = Partial<PricingParams>

/** 1. Value of the rubber per kg bought: F * y (THB/kg). */
export const valuePerKg = (F: number, y: number): number => F * y

/** 2. Fixed cost per kg bought: fixedCostPerDay / expectedDailyKg. Infinity when expectedDailyKg <= 0 (validateParams reports it). */
export const fixedPerKg = (fixedCostPerDay: number, expectedDailyKg: number): number =>
  expectedDailyKg > 0 ? fixedCostPerDay / expectedDailyKg : Number.POSITIVE_INFINITY

/** 3. Highest buy price that still earns the target margin, BEFORE rounding: F*y - fixedPerKg - targetMargin. */
export function maxBuyPrice(params: P = {}, y?: number): number {
  const p = resolveParams(params)
  const yy = y ?? p.baseYield
  return valuePerKg(p.factoryPrice, yy) - fixedPerKg(p.fixedCostPerDay, p.expectedDailyKg) - p.targetMargin
}

/**
 * 4. Suggested buy price.
 *  - rounded DOWN in steps of priceStep, capped at priceCap
 *  - if the rounded price is below priceFloor the price is NOT raised: it is returned as is with a NOT_WORTH warning
 */
export function suggestBuyPrice(params: P = {}, y?: number): PriceSuggestion {
  const p = resolveParams(params)
  const yy = y ?? p.baseYield
  const warnings: PriceWarning[] = []
  if (!isFiniteNumber(yy) || yy <= 0 || yy > 1) {
    warnings.push({ code: 'INVALID_YIELD', message: `ค่า y ไม่ถูกต้อง (${String(yy)}) — ต้องอยู่ระหว่าง 0 ถึง 1` })
    return { price: null, rawMax: Number.NaN, expectedMargin: Number.NaN, warnings }
  }
  const rawMax = maxBuyPrice(p, yy)
  const stepped = roundDownToStep(rawMax, p.priceStep)
  let price = stepped
  if (p.priceCap !== null && stepped > p.priceCap) {
    price = p.priceCap
    warnings.push({ code: 'CAPPED', message: `ราคาที่คำนวณได้ ${round2(stepped).toFixed(2)} สูงกว่าเพดาน ${p.priceCap.toFixed(2)} — จำกัดที่เพดาน (กำไรจะสูงกว่าเป้า)` })
  }
  if (p.priceFloor !== null && (rawMax < p.priceFloor || price < p.priceFloor)) {
    warnings.push({
      code: 'NOT_WORTH',
      message: `ไม่คุ้ม: ราคารับซื้อสูงสุดที่ได้กำไรเป้า ${round2(rawMax).toFixed(2)} ต่ำกว่าราคาพื้น ${p.priceFloor.toFixed(2)} บาท/กก. — ไม่ปรับราคาขึ้นให้ ควรหยุดรับหรือลดราคาตามเกรด`,
    })
  } else if (rawMax <= 0) {
    // even without a configured floor, a non-positive price can never be worth buying at
    warnings.push({ code: 'NOT_WORTH', message: 'ไม่คุ้ม: ราคาโรงงานนี้ต่ำเกินไป — ราคารับซื้อสูงสุดที่ยังไม่ขาดทุนไม่เกิน 0 บาท/กก.' })
  }
  const expectedMargin = valuePerKg(p.factoryPrice, yy) - fixedPerKg(p.fixedCostPerDay, p.expectedDailyKg) - price
  return { price, rawMax, expectedMargin, warnings }
}

/** 5. Suggested price for every grade A+..D. */
export function priceByGrade(params: P = {}): GradePriceRow[] {
  const p = resolveParams(params)
  return GRADES.map((grade) => ({ grade, yield: p.gradeYield[grade], ...suggestBuyPrice(p, p.gradeYield[grade]) }))
}

/** 6. Suggested price for a yield the user estimated by eye (e.g. very wet rubber y = 0.48). */
export const priceByEstimatedYield = (params: P, y: number): PriceSuggestion => suggestBuyPrice(params, y)

/** 7. Yield after the wetness drop for level 0..3 (level is clamped). Never below 0. */
export function wetnessAdjustment(params: P, wetnessLevel: number): number {
  const p = resolveParams(params)
  const level = clamp(Math.round(Number.isFinite(wetnessLevel) ? wetnessLevel : 0), 0, 3) as WetnessLevel
  return Math.max(0, p.baseYield - p.wetnessYieldDrop[level])
}

/** 10. Daily price board for the POS "daily price" page: one row per grade with price, y and margin. */
export function priceBoard(params: P = {}): PriceBoard {
  const p = resolveParams(params)
  const rows: PriceBoardRow[] = priceByGrade(p).map((r) => ({
    grade: r.grade,
    yield: r.yield,
    buyPrice: r.price,
    rawMax: r.rawMax,
    expectedMargin: r.expectedMargin,
    status: r.warnings.some((w) => w.code === 'NOT_WORTH') ? 'not_worth' : r.warnings.some((w) => w.code === 'CAPPED') ? 'capped' : 'ok',
    warnings: r.warnings,
  }))
  const warnings: PriceWarning[] = []
  const bad = rows.filter((r) => r.status === 'not_worth').map((r) => r.grade)
  if (bad.length) warnings.push({ code: 'NOT_WORTH', message: `เกรดที่ไม่คุ้มที่ราคาโรงงานนี้: ${bad.join(', ')}` })
  return {
    factoryPrice: p.factoryPrice,
    fixedPerKg: fixedPerKg(p.fixedCostPerDay, p.expectedDailyKg),
    targetMargin: p.targetMargin,
    priceFloor: p.priceFloor,
    priceCap: p.priceCap,
    rows,
    warnings,
  }
}

/** 11. Compare the suggested price with the market price (comparison only; never changes the price). */
export function compareToMarket(suggestedPrice: number, marketPrice: number, maxGap: number = resolveParams().marketWarnGap): MarketComparison {
  const diff = suggestedPrice - marketPrice
  const warnings: PriceWarning[] = []
  if (diff < -maxGap) {
    warnings.push({ code: 'BELOW_MARKET', message: `ราคาต่ำกว่าตลาด ${Math.abs(round2(diff)).toFixed(2)} บาท/กก. (เกิน ${maxGap.toFixed(2)}) — อาจเสียลูกค้าให้พ่อค้าคนกลาง` })
  }
  return { diff, diffPct: marketPrice > 0 ? (diff / marketPrice) * 100 : Number.NaN, warnings }
}

/**
 * 15. Reverse question: "if I set the buy price at `buyPrice`, what factory price (DRC 100%) do I need?"
 *  forTarget = (buyPrice + fixedPerKg + targetMargin) / y      breakeven = (buyPrice + fixedPerKg) / y
 */
export function requiredFactoryPrice(params: P, buyPrice: number, y?: number): RequiredFactoryPrice {
  const p = resolveParams(params)
  const yy = y ?? p.baseYield
  const fixed = fixedPerKg(p.fixedCostPerDay, p.expectedDailyKg)
  return { forTarget: (buyPrice + fixed + p.targetMargin) / yy, breakeven: (buyPrice + fixed) / yy }
}

/**
 * 16. y from the two things the shop can reason about: water lost on the way and the DRC the factory measures.
 *     y = (1 - loss%) * DRC%   e.g. loss 9 %, DRC 56 % -> 0.5096 dry kg per kg bought.
 */
export const yieldFromDrcLoss = (drcPct: number, lossPct: number): number => (1 - lossPct / 100) * (drcPct / 100)

/**
 * 17. Quote for ONE customer's rubber: expected water loss (and optionally their own DRC) -> y, then
 *   recommended = suggestBuyPrice (earns targetMargin)
 *   upper       = recommended + room.up     (what we can go up to when they haggle; status says whether it still makes money)
 *   lower       = recommended - room.down   (floor of the negotiation: used to push the price down when the rubber is uneven)
 *   breakevenPrice = highest price with margin 0
 * Status of a price: margin >= target -> ok · 0 < margin < target -> low · margin < 0 -> loss (do not raise the price that far).
 */
export function quoteRange(params: P, y: number, room: { up?: number; down?: number } = {}): QuoteRange {
  const p = resolveParams(params)
  const up = room.up ?? 1
  const down = room.down ?? 1
  const s = suggestBuyPrice(p, y)
  if (s.price === null) {
    return { y, recommended: null, upper: null, lower: null, breakevenPrice: null, marginAtRecommended: null, marginAtUpper: null, marginAtLower: null, upperStatus: null, recommendedStatus: null, warnings: s.warnings }
  }
  const fixed = fixedPerKg(p.fixedCostPerDay, p.expectedDailyKg)
  const marginAt = (price: number): number => valuePerKg(p.factoryPrice, y) - fixed - price
  const status = (m: number): MarginStatus => (m < -0.005 ? 'loss' : m < p.targetMargin - 0.005 ? 'low' : 'ok')
  const recommended = s.price
  const upper = recommended + Math.max(0, up)
  const lower = Math.max(0, recommended - Math.max(0, down))
  return {
    y,
    recommended,
    upper,
    lower,
    breakevenPrice: roundDownToStep(valuePerKg(p.factoryPrice, y) - fixed, p.priceStep),
    marginAtRecommended: marginAt(recommended),
    marginAtUpper: marginAt(upper),
    marginAtLower: marginAt(lower),
    upperStatus: status(marginAt(upper)),
    recommendedStatus: status(marginAt(recommended)),
    warnings: s.warnings,
  }
}
