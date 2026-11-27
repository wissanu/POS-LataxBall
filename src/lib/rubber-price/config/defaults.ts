import type { Grade, PricingParams } from '../types'

/**
 * Default configuration. EVERYTHING here is a starting value for the shop, not a fact:
 *  - gradeYield and wetnessYieldDrop are ASSUMPTIONS and must be calibrated from real lots (see calibrateYield).
 *  - factoryPrice (F) changes daily; 73 is only today's example.
 */
export const DEFAULT_GRADE_YIELD: Readonly<Record<Grade, number>> = {
  'A+': 0.6, // very clean, almost dry
  A: 0.58,
  'B+': 0.56,
  B: 0.55, // ordinary rubber
  'C+': 0.52,
  C: 0.5,
  D: 0.46, // soaked / dirty
}

export const DEFAULT_PARAMS: Readonly<PricingParams> = {
  factoryPrice: 73,
  baseYield: 0.55,
  targetMargin: 2.0,
  fixedCostPerDay: 1834,
  expectedDailyKg: 1800,
  priceCap: 37.5,
  priceFloor: 35.5,
  priceStep: 0.5,
  marketReferencePrice: 38,
  marketWarnGap: 1.0,
  maxDailyKg: 2000,
  gradeYield: DEFAULT_GRADE_YIELD,
  wetnessYieldDrop: [0, 0.02, 0.04, 0.07],
  emaAlpha: 0.3,
}

/** Merge per-call overrides over the defaults without mutating either. */
export function resolveParams(overrides: Partial<PricingParams> = {}): PricingParams {
  // `undefined` means "not given" (keep the default); `null` is a real value (e.g. no price cap)
  const given = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) as Partial<PricingParams>
  return {
    ...DEFAULT_PARAMS,
    ...given,
    gradeYield: { ...DEFAULT_PARAMS.gradeYield, ...(overrides.gradeYield ?? {}) },
    wetnessYieldDrop: overrides.wetnessYieldDrop ?? DEFAULT_PARAMS.wetnessYieldDrop,
  }
}
