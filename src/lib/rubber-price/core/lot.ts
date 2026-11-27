import { resolveParams } from '../config/defaults'
import type { LotInput, LotResult, PricingParams, SensitivityInput, SensitivityRow, WeightLotInput, WeightLotResult } from '../types'
import { fixedPerKg } from './pricing'

/** 8. Simulate one lot. revenue = F*kg*y, cost = buyPrice*kg, net = gross - fixedCostForLot, breakeven y = (cost + fixed) / (F*kg). */
export function simulateLot({ kg, buyPrice, F, y, fixedCostForLot }: LotInput): LotResult {
  const cost = buyPrice * kg
  const revenue = F * kg * y
  const gross = revenue - cost
  const net = gross - fixedCostForLot
  const breakevenYield = F * kg > 0 ? (cost + fixedCostForLot) / (F * kg) : Number.NaN
  return { cost, revenue, gross, net, breakevenYield, netPerKg: kg > 0 ? net / kg : Number.NaN }
}

/** 9. Net profit of a lot for each y in yRange (inclusive), `step` apart. Index-based so floating point error does not accumulate. */
export function sensitivityTable(input: SensitivityInput, params: Partial<PricingParams> = {}): SensitivityRow[] {
  const p = resolveParams(params)
  const { kg, buyPrice, F, yRange, step } = input
  if (!(step > 0) || !(yRange[1] >= yRange[0])) return []
  const fixed = input.fixedCostForLot ?? fixedPerKg(p.fixedCostPerDay, p.expectedDailyKg) * kg
  const n = Math.floor((yRange[1] - yRange[0]) / step + 1e-9)
  const rows: SensitivityRow[] = []
  for (let i = 0; i <= n; i++) {
    const y = Math.round((yRange[0] + i * step) * 1e6) / 1e6
    const r = simulateLot({ kg, buyPrice, F, y, fixedCostForLot: fixed })
    rows.push({ y, revenue: r.revenue, net: r.net, netPerKg: r.netPerKg })
  }
  return rows
}

/**
 * 8b. Same lot, described by weights: bought kg -> minus water lost on the way -> kg at the factory -> x DRC -> dry kg -> x F.
 * Worked example: 1,500 kg, loss 9 %, DRC 56 %, F 72 -> 1,365 kg at the factory, 764.4 dry kg, revenue 55,036.80.
 * Consistent with simulateLot: it is simulateLot with y = (1 - loss) * DRC.
 */
export function simulateLotFromWeights({ kgBought, lossPct, drcPct, F, buyPrice, fixedCostForLot }: WeightLotInput): WeightLotResult {
  const kgLost = (kgBought * lossPct) / 100
  const kgAtFactory = kgBought - kgLost
  const dryKg = (kgAtFactory * drcPct) / 100
  const y = kgBought > 0 ? dryKg / kgBought : (1 - lossPct / 100) * (drcPct / 100)
  const base = simulateLot({ kg: kgBought, buyPrice, F, y, fixedCostForLot })
  const costAll = base.cost + fixedCostForLot
  return {
    ...base,
    kgLost,
    kgAtFactory,
    dryKg,
    yield: y,
    breakevenDrcPct: F * kgAtFactory > 0 ? (costAll / (F * kgAtFactory)) * 100 : null,
    breakevenLossPct: F * kgBought * (drcPct / 100) > 0 ? (1 - costAll / (F * kgBought * (drcPct / 100))) * 100 : null,
  }
}
