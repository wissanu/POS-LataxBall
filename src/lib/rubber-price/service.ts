import { resolveParams } from './config/defaults'
import * as core from './core'
import type { CashNeededInput, PricingParams, RealLot, SensitivityInput } from './types'

/**
 * Thin service layer — the shape a NestJS provider would take later (constructor injection of config, methods delegate to the pure core).
 * No framework dependency here, so the core stays usable on its own.
 */
export class RubberPriceService {
  private readonly params: PricingParams
  constructor(overrides: Partial<PricingParams> = {}) {
    this.params = resolveParams(overrides)
  }
  /** Per-call overrides win over the injected config. */
  private with(o?: Partial<PricingParams>): PricingParams { return resolveParams({ ...this.params, ...o, gradeYield: { ...this.params.gradeYield, ...(o?.gradeYield ?? {}) } }) }
  suggest(o?: Partial<PricingParams>) { return core.suggestBuyPrice(this.with(o)) }
  byGrade(o?: Partial<PricingParams>) { return core.priceByGrade(this.with(o)) }
  byYield(y: number, o?: Partial<PricingParams>) { return core.priceByEstimatedYield(this.with(o), y) }
  board(o?: Partial<PricingParams>) { return core.priceBoard(this.with(o)) }
  simulate(input: Parameters<typeof core.simulateLot>[0]) { return core.simulateLot(input) }
  sensitivity(input: SensitivityInput, o?: Partial<PricingParams>) { return core.sensitivityTable(input, this.with(o)) }
  calibrate(lots: readonly RealLot[], o?: Partial<PricingParams>) { return core.calibrateYield(lots, this.with(o)) }
  cash(input: CashNeededInput, o?: Partial<PricingParams>) { return core.cashNeeded(input, this.with(o)) }
  validate(o?: Partial<PricingParams>) { return core.validateParams(this.with(o)) }
}
