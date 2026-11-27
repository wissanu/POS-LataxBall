import { resolveParams } from '../config/defaults'
import type { CashNeeded, CashNeededInput, PricingParams } from '../types'

/** 13. Cash to prepare for the day: (expectedKg + z*sigmaKg) * buyPrice, never more than maxDailyKg * buyPrice. */
export function cashNeeded({ expectedKg, sigmaKg, buyPrice, z }: CashNeededInput, params: Partial<PricingParams> = {}): CashNeeded {
  const p = resolveParams(params)
  const wanted = Math.max(0, expectedKg + z * sigmaKg)
  const plannedKg = Math.min(wanted, p.maxDailyKg)
  return { plannedKg, cash: plannedKg * buyPrice, capped: wanted > p.maxDailyKg }
}
