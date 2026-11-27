import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARAMS,
  RubberPriceService,
  calibrateYield,
  cashNeeded,
  compareToMarket,
  fixedPerKg,
  maxBuyPrice,
  priceBoard,
  priceByEstimatedYield,
  quoteRange,
  priceByGrade,
  requiredFactoryPrice,
  roundDownToStep,
  sensitivityTable,
  simulateLot,
  simulateLotFromWeights,
  yieldFromDrcLoss,
  suggestBuyPrice,
  validateParams,
  valuePerKg,
  wetnessAdjustment,
} from '../index'

describe('spec test cases', () => {
  it('1. lot simulation F=73 y=0.55 kg=1500 buy=38.5 fixed=1834', () => {
    const r = simulateLot({ kg: 1500, buyPrice: 38.5, F: 73, y: 0.55, fixedCostForLot: 1834 })
    expect(r.cost).toBeCloseTo(57750, 6)
    expect(r.revenue).toBeCloseTo(60225, 6)
    expect(r.gross).toBeCloseTo(2475, 6)
    expect(r.net).toBeCloseTo(641, 6)
    // formula (buy*kg + fixed) / (F*kg) = 59584 / 109500 = 0.54415 ; spec says ~0.5438 (within 0.0005)
    expect(r.breakevenYield).toBeCloseTo(0.5438, 3)
    expect(r.breakevenYield).toBeCloseTo(59584 / 109500, 10)
    // at the breakeven yield the lot nets exactly 0
    const be = simulateLot({ kg: 1500, buyPrice: 38.5, F: 73, y: r.breakevenYield, fixedCostForLot: 1834 })
    expect(be.net).toBeCloseTo(0, 6)
  })

  it('2. margin 2 -> maxBuy ~37.13 -> suggested 37.00', () => {
    expect(fixedPerKg(1834, 1800)).toBeCloseTo(1.019, 3)
    expect(maxBuyPrice({ factoryPrice: 73, baseYield: 0.55, targetMargin: 2 })).toBeCloseTo(37.13, 2)
    const s = suggestBuyPrice({ factoryPrice: 73, baseYield: 0.55, targetMargin: 2 })
    expect(s.price).toBe(37)
    expect(s.warnings).toEqual([])
  })

  it('3. margin 3 -> suggested 36.00', () => {
    expect(suggestBuyPrice({ factoryPrice: 73, targetMargin: 3 }).price).toBe(36)
  })

  it('4. grade D (y=0.46) at F=73 -> below floor -> NOT_WORTH warning, price is NOT raised', () => {
    const s = suggestBuyPrice({ factoryPrice: 73 }, 0.46)
    expect(s.rawMax).toBeLessThan(DEFAULT_PARAMS.priceFloor ?? 0)
    expect(s.price).not.toBeNull()
    expect(s.price as number).toBeLessThan(DEFAULT_PARAMS.priceFloor ?? 0) // never silently lifted to the floor
    expect(s.warnings.some((w) => w.code === 'NOT_WORTH' && w.message.includes('ไม่คุ้ม'))).toBe(true)
    const d = priceByGrade({ factoryPrice: 73 }).find((r) => r.grade === 'D')
    expect(d?.warnings.some((w) => w.code === 'NOT_WORTH')).toBe(true)
  })

  it('5. every +0.01 of y adds 0.73 to maxBuy at F=73', () => {
    const a = maxBuyPrice({ factoryPrice: 73 }, 0.55)
    const b = maxBuyPrice({ factoryPrice: 73 }, 0.56)
    const c = maxBuyPrice({ factoryPrice: 73 }, 0.57)
    expect(b - a).toBeCloseTo(0.73, 9)
    expect(c - b).toBeCloseTo(0.73, 9)
  })

  it('6. validateParams catches y=1.2 and F=0', () => {
    const issues = validateParams({ baseYield: 1.2, factoryPrice: 0 })
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(['baseYield', 'factoryPrice']))
    expect(validateParams({ gradeYield: { ...DEFAULT_PARAMS.gradeYield, A: 1.2 } }).some((i) => i.field === 'gradeYield.A')).toBe(true)
    expect(validateParams({ priceFloor: 40, priceCap: 37 }).some((i) => i.field === 'priceFloor')).toBe(true)
    expect(validateParams()).toEqual([])
  })

  it('7. calibrateYield single lot 1813.3 -> 1699.8 kg, DRC 58.7% gives y ~0.55', () => {
    const r = calibrateYield([{ grade: 'B', kgPurchased: 1813.3, kgFactory: 1699.8, drcPercent: 58.7 }])
    expect(r.weightedYield).toBeCloseTo(0.55, 2)
    expect(r.emaYield).toBeCloseTo(0.55, 2)
    expect(r.lotCount).toBe(1)
    expect(r.byGrade.B?.yield).toBeCloseTo(0.55, 2)
  })
})

describe('other behaviour', () => {
  it('valuePerKg and roundDownToStep', () => {
    expect(valuePerKg(73, 0.55)).toBeCloseTo(40.15, 9)
    expect(roundDownToStep(37.13, 0.5)).toBe(37)
    expect(roundDownToStep(36.0000000001, 0.5)).toBe(36) // floating point noise does not drop a step
    expect(roundDownToStep(37.49, 0.5)).toBe(37)
  })

  it('suggestBuyPrice caps at priceCap with a CAPPED warning', () => {
    const s = suggestBuyPrice({ factoryPrice: 80 })
    expect(s.price).toBe(37.5)
    expect(s.warnings.some((w) => w.code === 'CAPPED')).toBe(true)
  })

  it('invalid yield returns null price and a warning instead of throwing', () => {
    const s = priceByEstimatedYield({}, 1.2)
    expect(s.price).toBeNull()
    expect(s.warnings[0]?.code).toBe('INVALID_YIELD')
  })

  it('per-call overrides win, defaults are not mutated', () => {
    const before = JSON.stringify(DEFAULT_PARAMS)
    expect(suggestBuyPrice({ factoryPrice: 73, targetMargin: 3 }).price).toBe(36)
    expect(suggestBuyPrice({ factoryPrice: 73 }).price).toBe(37)
    expect(JSON.stringify(DEFAULT_PARAMS)).toBe(before)
  })

  it('wetnessAdjustment lowers y per level and clamps the level', () => {
    const y0 = wetnessAdjustment({}, 0)
    expect(y0).toBeCloseTo(0.55, 9)
    expect(wetnessAdjustment({}, 1)).toBeLessThan(y0)
    expect(wetnessAdjustment({}, 3)).toBeLessThan(wetnessAdjustment({}, 2))
    expect(wetnessAdjustment({}, 9)).toBe(wetnessAdjustment({}, 3))
    expect(wetnessAdjustment({ wetnessYieldDrop: [0, 0.1, 0.2, 0.3] }, 2)).toBeCloseTo(0.35, 9)
  })

  it('priceBoard has all grades, ordered, with status', () => {
    const b = priceBoard({ factoryPrice: 73 })
    expect(b.rows.map((r) => r.grade)).toEqual(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'])
    expect(b.rows.find((r) => r.grade === 'D')?.status).toBe('not_worth')
    expect(b.rows.find((r) => r.grade === 'B')?.status).toBe('ok')
    expect(b.warnings.length).toBeGreaterThan(0)
  })

  it('compareToMarket warns only when below the market by more than the gap', () => {
    expect(compareToMarket(37, 38, 1.5).warnings).toEqual([])
    const c = compareToMarket(36, 38, 1.5)
    expect(c.diff).toBe(-2)
    expect(c.warnings[0]?.code).toBe('BELOW_MARKET')
  })

  it('sensitivityTable steps by index and matches simulateLot', () => {
    const rows = sensitivityTable({ kg: 1500, buyPrice: 38.5, F: 73, yRange: [0.5, 0.6], step: 0.01, fixedCostForLot: 1834 })
    expect(rows).toHaveLength(11)
    expect(rows[0]?.y).toBe(0.5)
    expect(rows[10]?.y).toBe(0.6)
    expect(rows[5]?.net).toBeCloseTo(641, 6)
  })

  it('calibrateYield: weighted vs EMA, skips invalid lots', () => {
    const r = calibrateYield([
      { kgPurchased: 1000, kgFactory: 900, drcPercent: 60 }, // y 0.54
      { kgPurchased: 3000, kgFactory: 2700, drcPercent: 62 }, // y 0.558
      { kgPurchased: 0, kgFactory: 10, drcPercent: 50 }, // invalid
    ])
    expect(r.lotCount).toBe(2)
    expect(r.skippedLots).toBe(1)
    expect(r.weightedYield).toBeCloseTo((540 + 1674) / 4000, 9)
    expect(r.emaYield).toBeCloseTo(0.3 * 0.558 + 0.7 * 0.54, 9)
    expect(calibrateYield([]).weightedYield).toBeNull()
  })

  it('cashNeeded is capped by maxDailyKg', () => {
    const a = cashNeeded({ expectedKg: 1500, sigmaKg: 200, buyPrice: 37, z: 1.64 })
    expect(a.plannedKg).toBeCloseTo(1828, 6)
    expect(a.cash).toBeCloseTo(1828 * 37, 6)
    expect(a.capped).toBe(false)
    const b = cashNeeded({ expectedKg: 1900, sigmaKg: 300, buyPrice: 37, z: 1.64 })
    expect(b.plannedKg).toBe(2000)
    expect(b.cash).toBe(2000 * 37)
    expect(b.capped).toBe(true)
  })

  it('service layer delegates to the core with injected config', () => {
    const svc = new RubberPriceService({ factoryPrice: 73, targetMargin: 3 })
    expect(svc.suggest().price).toBe(36)
    expect(svc.suggest({ targetMargin: 2 }).price).toBe(37)
    expect(svc.byGrade()).toHaveLength(7)
    expect(svc.validate({ factoryPrice: 0 }).length).toBe(1)
  })

  it('optional values: no cap / no floor / no market (null) are allowed', () => {
    const s = suggestBuyPrice({ factoryPrice: 80, priceCap: null, priceFloor: null, targetMargin: 0, fixedCostPerDay: 0 })
    expect(s.price).toBe(44) // 80*0.55 = 44, no cap applied
    expect(s.warnings).toEqual([])
    expect(validateParams({ priceCap: null, priceFloor: null, marketReferencePrice: null })).toEqual([])
    // a non-positive max price is still flagged even without a floor
    expect(suggestBuyPrice({ factoryPrice: 1, priceFloor: null, priceCap: null }).warnings.some((w) => w.code === 'NOT_WORTH')).toBe(true)
    // undefined means "not given" -> default kept
    expect(suggestBuyPrice({ factoryPrice: 73, targetMargin: undefined }).price).toBe(37)
  })

  it('requiredFactoryPrice is the inverse of maxBuyPrice', () => {
    const r = requiredFactoryPrice({ targetMargin: 2 }, 37, 0.55)
    expect(r.forTarget).toBeCloseTo((37 + 1834 / 1800 + 2) / 0.55, 9)
    expect(maxBuyPrice({ factoryPrice: r.forTarget, baseYield: 0.55, targetMargin: 2 })).toBeCloseTo(37, 9)
    expect(r.breakeven).toBeLessThan(r.forTarget)
  })

  it('weight chain: 1,500 kg, loss 9 %, DRC 56 %, F 72 -> 1,365 kg, 764.4 dry kg, 55,036.80 baht', () => {
    const r = simulateLotFromWeights({ kgBought: 1500, lossPct: 9, drcPct: 56, F: 72, buyPrice: 36, fixedCostForLot: 0 })
    expect(r.kgLost).toBeCloseTo(135, 9)
    expect(r.kgAtFactory).toBeCloseTo(1365, 9)
    expect(r.dryKg).toBeCloseTo(764.4, 9)
    expect(r.revenue).toBeCloseTo(55036.8, 6)
    expect(r.yield).toBeCloseTo(0.5096, 9)
    expect(r.cost).toBe(54000)
    expect(r.net).toBeCloseTo(1036.8, 6)
  })

  it('weights model equals simulateLot with y = (1 - loss) * DRC, and break-even points give net 0', () => {
    const w = simulateLotFromWeights({ kgBought: 1500, lossPct: 9, drcPct: 56, F: 72, buyPrice: 36.5, fixedCostForLot: 1000 })
    const l = simulateLot({ kg: 1500, buyPrice: 36.5, F: 72, y: yieldFromDrcLoss(56, 9), fixedCostForLot: 1000 })
    expect(w.net).toBeCloseTo(l.net, 9)
    const atDrc = simulateLotFromWeights({ kgBought: 1500, lossPct: 9, drcPct: w.breakevenDrcPct as number, F: 72, buyPrice: 36.5, fixedCostForLot: 1000 })
    expect(atDrc.net).toBeCloseTo(0, 6)
    const atLoss = simulateLotFromWeights({ kgBought: 1500, lossPct: w.breakevenLossPct as number, drcPct: 56, F: 72, buyPrice: 36.5, fixedCostForLot: 1000 })
    expect(atLoss.net).toBeCloseTo(0, 6)
  })

  it('price recommendation and lot simulation agree: buying at the suggested price nets the target margin per kg', () => {
    const y = yieldFromDrcLoss(56, 9)
    const p = { factoryPrice: 72, targetMargin: 2, fixedCostPerDay: 0, priceStep: 0.01, priceCap: null, priceFloor: null }
    const s = suggestBuyPrice(p, y)
    const lot = simulateLotFromWeights({ kgBought: 1000, lossPct: 9, drcPct: 56, F: 72, buyPrice: s.price as number, fixedCostForLot: 0 })
    expect(lot.netPerKg).toBeGreaterThanOrEqual(2 - 1e-9) // rounded DOWN, so margin is at least the target
    expect(lot.netPerKg).toBeLessThan(2.011)
  })

  it('calibrateYield also reports loss % and DRC %', () => {
    const r = calibrateYield([{ kgPurchased: 1500, kgFactory: 1365, drcPercent: 56 }])
    expect(r.weightedLossPct).toBeCloseTo(9, 9)
    expect(r.weightedDrcPct).toBeCloseTo(56, 9)
    expect(r.weightedYield).toBeCloseTo(yieldFromDrcLoss(56, 9), 9)
  })

  it('quoteRange: F=72, loss 9 %, DRC 56 %, margin 1 -> recommended / upper / lower with margin status', () => {
    const y = yieldFromDrcLoss(56, 9)
    const q = quoteRange({ factoryPrice: 72, targetMargin: 1, fixedCostPerDay: 0, priceCap: null, priceFloor: null }, y, { up: 1, down: 1 })
    expect(q.recommended).toBe(35.5) // 72*0.5096 = 36.69 - 1 = 35.69 -> 35.5
    expect(q.upper).toBe(36.5)
    expect(q.lower).toBe(34.5)
    expect(q.marginAtRecommended).toBeCloseTo(36.6912 - 35.5, 6)
    expect(q.recommendedStatus).toBe('ok')
    expect(q.upperStatus).toBe('low') // profit 0.19 but below the 1.00 target
    expect(q.marginAtLower as number).toBeGreaterThan(q.marginAtRecommended as number)
    expect(q.breakevenPrice).toBe(36.5)
  })

  it('quoteRange: upper ceiling is flagged loss when raising the price goes past break-even', () => {
    const y = yieldFromDrcLoss(56, 12) // wetter rubber
    const q = quoteRange({ factoryPrice: 72, targetMargin: 1, fixedCostPerDay: 0, priceCap: null, priceFloor: null }, y, { up: 2, down: 1 })
    expect(q.upperStatus).toBe('loss')
    expect(q.marginAtUpper as number).toBeLessThan(0)
    expect(q.recommendedStatus).toBe('ok') // the recommended price itself still earns the target
    expect(q.lower as number).toBeLessThan(q.recommended as number)
  })

  it('quoteRange with an invalid y returns nulls and a warning (no throw)', () => {
    const q = quoteRange({ factoryPrice: 72 }, 1.4)
    expect(q.recommended).toBeNull()
    expect(q.warnings[0]?.code).toBe('INVALID_YIELD')
  })
})
