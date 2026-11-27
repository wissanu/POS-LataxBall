import { resolveParams } from '../config/defaults'
import type { CalibrationResult, Grade, PricingParams, RealLot } from '../types'

/** Yield of one real lot: dry rubber (kgFactory * DRC%) per kg purchased. */
const lotYield = (l: RealLot): number => (l.kgFactory * (l.drcPercent / 100)) / l.kgPurchased

const valid = (l: RealLot): boolean =>
  Number.isFinite(l.kgPurchased) && l.kgPurchased > 0 && Number.isFinite(l.kgFactory) && l.kgFactory > 0 && Number.isFinite(l.drcPercent) && l.drcPercent > 0 && l.drcPercent <= 100

/**
 * 12. Calibrate yield from real lots { grade, kgPurchased, kgFactory, drcPercent }.
 *  weightedYield = sum(dry) / sum(kg purchased)   (big lots count more) = (1 - weightedLoss) * weightedDrc
 *  weightedLossPct = water lost on the way, weightedDrcPct = DRC measured by the factory
 *  emaYield      = EMA of per-lot yield in the given order (recent lots count more; alpha from params.emaAlpha)
 * Invalid lots are skipped and counted. Use the result to update the grade -> yield table.
 */
export function calibrateYield(lots: readonly RealLot[], params: Partial<PricingParams> = {}): CalibrationResult {
  const p = resolveParams(params)
  const ok = lots.filter(valid)
  const totalKg = ok.reduce((a, l) => a + l.kgPurchased, 0)
  const dry = ok.reduce((a, l) => a + l.kgFactory * (l.drcPercent / 100), 0)
  let ema: number | null = null
  for (const l of ok) {
    const y = lotYield(l)
    ema = ema === null ? y : p.emaAlpha * y + (1 - p.emaAlpha) * ema
  }
  const factoryKg = ok.reduce((a, l) => a + l.kgFactory, 0)
  const byGrade: CalibrationResult['byGrade'] = {}
  for (const g of new Set(ok.map((l) => l.grade).filter((x): x is Grade => !!x))) {
    const gl = ok.filter((l) => l.grade === g)
    const kg = gl.reduce((a, l) => a + l.kgPurchased, 0)
    const fk = gl.reduce((a, l) => a + l.kgFactory, 0)
    const gd = gl.reduce((a, l) => a + l.kgFactory * (l.drcPercent / 100), 0)
    byGrade[g] = { yield: gd / kg, lossPct: (1 - fk / kg) * 100, drcPct: (gd / fk) * 100, lots: gl.length, kgPurchased: kg }
  }
  return { weightedYield: totalKg > 0 ? dry / totalKg : null, weightedLossPct: totalKg > 0 ? (1 - factoryKg / totalKg) * 100 : null, weightedDrcPct: factoryKg > 0 ? (dry / factoryKg) * 100 : null, emaYield: ema, lotCount: ok.length, skippedLots: lots.length - ok.length, totalKgPurchased: totalKg, byGrade }
}
