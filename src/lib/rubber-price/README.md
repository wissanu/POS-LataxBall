# rubber-price — cup-lump rubber buy-price calculator

Pure TypeScript (strict), no runtime dependencies. Tests: Vitest.

```
types/      Grade, PricingParams, result types
config/     DEFAULT_PARAMS (all overridable per call via Partial<PricingParams>)
core/       pricing.ts  valuePerKg fixedPerKg maxBuyPrice suggestBuyPrice priceByGrade priceByEstimatedYield wetnessAdjustment priceBoard compareToMarket
            lot.ts      simulateLot sensitivityTable
            calibration.ts calibrateYield     cash.ts cashNeeded     validation.ts validateParams
service.ts  RubberPriceService — thin class shaped like a NestJS provider (no framework import)
tests/      pricing.test.ts (the 7 spec cases + extra behaviour)
```

Run: `npm run test:price` · type check (strict): `npm run typecheck:price`

## Assumptions
- Money in THB, weights in kg, yields as fractions (0.55 = 55 %). Rounding is done only at the last step (`roundDownToStep` is tolerant of floating point noise).
- `suggestBuyPrice`: round DOWN to `priceStep`, cap at `priceCap`. If the result is below `priceFloor` the price is **not** raised — it is returned with a `NOT_WORTH` warning. A capped price returns a `CAPPED` warning. Invalid y returns `price: null` + `INVALID_YIELD` (nothing throws).
- Breakeven yield uses the spec formula `(buyPrice*kg + fixedCostForLot) / (F*kg)`. For test 1 this is 59,584 / 109,500 = 0.54415 (the spec text says ≈ 0.5438; the test accepts it within 0.0005).
- `sensitivityTable` fixed cost defaults to `fixedPerKg * kg` when `fixedCostForLot` is not given.
- Wetness drops are absolute yield points per level 0..3 (default 0 / 2 / 4 / 7 points).
- `priceCap`, `priceFloor` and `marketReferencePrice` may be `null` (= not used). `undefined` means "not given" and keeps the default. Even with no floor, a max price <= 0 is flagged `NOT_WORTH`.
- `requiredFactoryPrice(params, buyPrice, y?)` answers the reverse question: the factory price (DRC 100 %) needed for a given buy price.
- Weight chain (used by the UI so price, tables and charts agree): bought kg -> minus water lost on the way (loss %) -> kg at factory -> x DRC % = dry kg -> x F = revenue. `yieldFromDrcLoss(drc, loss) = (1 - loss) * DRC` is the y used by every price function; `simulateLotFromWeights` is `simulateLot` with that y plus the weight steps and break-even DRC / loss. Worked example (tested): 1,500 kg, loss 9 %, DRC 56 %, F 72 -> 1,365 kg, 764.4 dry kg, 55,036.80 baht.
- `calibrateYield` also returns the weighted loss % (1 - sum(factory kg)/sum(purchased kg)) and DRC % (sum(dry kg)/sum(factory kg)).
- `quoteRange(params, y, {up, down})` = quote for one customer: recommended price (earns the target margin), upper ceiling (= recommended + up; status `loss` when paying that much loses money -> do not raise), lower ceiling (= recommended - down, to push the price down for uneven rubber) and the break-even price.
- Prices are only ever adjusted per kg by grade — nothing here suggests adjusting the scale or deducting weight.

## Example
```ts
import { priceBoard } from '@/lib/rubber-price'
priceBoard({ factoryPrice: 73 }).rows
// grade  y    max(before round)  price  margin  status
// A+     60%  40.78              37.5   5.28    capped
// A      58%  39.32              37.5   3.82    capped
// B+     56%  37.86              37.5   2.36    ok
// B      55%  37.13              37.0   2.13    ok
// C+     52%  34.94              34.5   2.44    not_worth   (below floor 35.5 — warning, price not raised)
// C      50%  33.48              33.0   2.48    not_worth
// D      46%  30.56              30.5   2.06    not_worth
```

## Values to calibrate from real data
1. Per-grade water loss % and DRC % (the UI default: B = loss 6.3 %, DRC 58.7 % from the real lot; other grades assumed) — `gradeYield` in the core is derived from these in the UI; assumed; use `calibrateYield(lots)` with `grade`, `kgPurchased`, `kgFactory`, `drcPercent` per lot (real lot: 1,813.3 kg → 1,699.8 kg at DRC 58.7 % gives y ≈ 0.55).
2. `wetnessYieldDrop` (levels 1–3) — assumed 2 / 4 / 7 points.
3. `baseYield` (0.55) — from the weighted / EMA yield of recent lots; `emaAlpha` (0.3).
4. `fixedCostPerDay` (1,834) and `expectedDailyKg` (1,800) — from the real daily books.
5. `targetMargin` (2.0), `priceFloor` (35.5), `priceCap` (37.5), `priceStep` (0.5), `marketWarnGap` (1.0), `marketReferencePrice` (38).
6. Cash planning: σ of daily kg and z (1.64 ≈ 95 %); `maxDailyKg` (2,000).
