/** Rubber grades, best to worst. */
export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D'
export const GRADES: readonly Grade[] = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'] as const

/** Wetness level of the rubber as judged by eye: 0 = normal ... 3 = very wet. */
export type WetnessLevel = 0 | 1 | 2 | 3

/**
 * All tunable values. Every function accepts `Partial<PricingParams>` and merges it over DEFAULT_PARAMS,
 * so any value can be overridden per call without touching the config file.
 * Money is THB, weights are kg, yields/fractions are 0..1 (not percent).
 */
export interface PricingParams {
  /** F: factory price per kg of dry rubber at DRC 100% (THB/kg). Entered daily by the user. */
  factoryPrice: number
  /** Base yield y: dry rubber obtained per 1 kg bought (already includes transport / drip loss). */
  baseYield: number
  /** Target margin per kg bought (THB/kg). */
  targetMargin: number
  /** Fixed cost per day (labour, fuel ...) THB/day. */
  fixedCostPerDay: number
  /** Expected kg bought per day — used to spread the fixed cost. */
  expectedDailyKg: number
  /** Normal price range. A suggested price above the cap is capped; below the floor it is flagged "not worth it", never raised silently. */
  /** null = no cap / no floor (optional). */
  priceCap: number | null
  priceFloor: number | null
  /** Round the price DOWN in steps of this many THB. */
  priceStep: number
  /** Middle-man market price, comparison only. */
  marketReferencePrice: number | null
  /** Warn when the suggested price is lower than the market by more than this many THB/kg (risk of losing customers). */
  marketWarnGap: number
  /** Hard cap on kg bought per day. */
  maxDailyKg: number
  /** ASSUMED grade -> yield table. Must be calibrated from real lots (see calibrateYield). */
  gradeYield: Record<Grade, number>
  /** ASSUMED absolute yield drop for wetness levels 0..3. Must be calibrated. */
  wetnessYieldDrop: readonly [number, number, number, number]
  /** EMA smoothing factor for calibrateYield (0..1). */
  emaAlpha: number
}

/** Result of requiredFactoryPrice. */
export interface RequiredFactoryPrice {
  /** Lowest factory price (DRC 100%) at which buying at `buyPrice` still earns the target margin. */
  forTarget: number
  /** Lowest factory price at which buying at `buyPrice` just covers cost + fixed cost (margin 0). */
  breakeven: number
}

/** Margin status of one price: ok = reaches the target margin, low = profit but below target, loss = loses money. */
export type MarginStatus = 'ok' | 'low' | 'loss'
export interface QuoteRange {
  /** y used = (1 - loss) * DRC for this particular customer's rubber. */
  y: number
  /** Price to quote (rounded down, earns the target margin). null when the inputs are invalid. */
  recommended: number | null
  /** recommended + room: what we may go up to if the customer haggles. */
  upper: number | null
  /** recommended - room (never below 0): where to start pushing the price down for uneven rubber. */
  lower: number | null
  /** Highest price that does not lose money at all (margin 0), rounded down to the step. */
  breakevenPrice: number | null
  marginAtRecommended: number | null
  marginAtUpper: number | null
  marginAtLower: number | null
  upperStatus: MarginStatus | null
  recommendedStatus: MarginStatus | null
  warnings: PriceWarning[]
}

export type WarningCode = 'NOT_WORTH' | 'CAPPED' | 'INVALID_YIELD' | 'BELOW_MARKET'
export interface PriceWarning {
  code: WarningCode
  message: string
}

export interface PriceSuggestion {
  /** Suggested buy price (THB/kg), rounded down to the step and capped at priceCap. null when the inputs are invalid. */
  price: number | null
  /** F*y - fixedPerKg - margin before rounding/clamping. */
  rawMax: number
  /** Expected margin per kg at `price` (THB/kg). */
  expectedMargin: number
  warnings: PriceWarning[]
}

export interface GradePriceRow extends PriceSuggestion {
  grade: Grade
  yield: number
}

export interface LotInput {
  kg: number
  buyPrice: number
  F: number
  y: number
  fixedCostForLot: number
}
export interface LotResult {
  cost: number
  revenue: number
  gross: number
  net: number
  /** y at which net = 0. */
  breakevenYield: number
  netPerKg: number
}

/**
 * Lot described by weights, the way the shop actually experiences it:
 *   bought kg -> (water lost on the way, lossPct) -> kg arriving at the factory -> x DRC% = dry rubber kg -> x F = revenue
 */
export interface WeightLotInput {
  kgBought: number
  /** Water / weight lost between the shop and the factory, % of the kg bought (e.g. 9). */
  lossPct: number
  /** DRC measured by the factory, % (e.g. 56). */
  drcPct: number
  /** Factory price per kg of dry rubber (DRC 100%). */
  F: number
  buyPrice: number
  fixedCostForLot: number
}
export interface WeightLotResult extends LotResult {
  kgLost: number
  kgAtFactory: number
  dryKg: number
  /** Dry rubber per kg bought = (1 - loss) * DRC. */
  yield: number
  /** DRC (%) at which this lot nets 0, keeping the loss rate. null if nothing arrives. */
  breakevenDrcPct: number | null
  /** Loss (%) at which this lot nets 0, keeping the DRC. Negative = loses money even with no loss at all. null if not computable. */
  breakevenLossPct: number | null
}

export interface SensitivityInput {
  kg: number
  buyPrice: number
  F: number
  /** [from, to] inclusive. */
  yRange: readonly [number, number]
  step: number
  /** Defaults to fixedPerKg * kg from the params. */
  fixedCostForLot?: number
}
export interface SensitivityRow {
  y: number
  revenue: number
  net: number
  netPerKg: number
}

export interface PriceBoardRow {
  grade: Grade
  yield: number
  buyPrice: number | null
  rawMax: number
  expectedMargin: number
  status: 'ok' | 'capped' | 'not_worth'
  warnings: PriceWarning[]
}
export interface PriceBoard {
  factoryPrice: number
  fixedPerKg: number
  targetMargin: number
  priceFloor: number | null
  priceCap: number | null
  rows: PriceBoardRow[]
  warnings: PriceWarning[]
}

export interface MarketComparison {
  /** suggested - market (negative = we pay less than the market). */
  diff: number
  diffPct: number
  warnings: PriceWarning[]
}

export interface RealLot {
  grade?: Grade
  kgPurchased: number
  kgFactory: number
  drcPercent: number
}
export interface CalibrationResult {
  /** sum(dry rubber) / sum(kg purchased) over valid lots. */
  weightedYield: number | null
  /** 1 - sum(kg at factory) / sum(kg purchased), in %. Water lost on the way. */
  weightedLossPct: number | null
  /** sum(dry kg) / sum(kg at factory), in %. */
  weightedDrcPct: number | null
  /** Exponential moving average of per-lot yield, in the order given. */
  emaYield: number | null
  lotCount: number
  skippedLots: number
  totalKgPurchased: number
  byGrade: Partial<Record<Grade, { yield: number; lossPct: number; drcPct: number; lots: number; kgPurchased: number }>>
}

export interface CashNeededInput {
  expectedKg: number
  sigmaKg: number
  buyPrice: number
  /** z-score, e.g. 1.64 ~ 95%. */
  z: number
}
export interface CashNeeded {
  /** kg actually planned = min(expectedKg + z*sigma, maxDailyKg). */
  plannedKg: number
  cash: number
  capped: boolean
}

export interface ValidationIssue {
  field: string
  message: string
}
