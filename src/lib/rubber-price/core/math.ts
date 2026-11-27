/** Small numeric helpers. All pure. Rounding is done only at the final step of each calculation. */

const EPS = 1e-9

/** Round DOWN to a multiple of `step` (tolerant of floating point noise: 37.0000000001 stays 37). */
export function roundDownToStep(x: number, step: number): number {
  if (!(step > 0)) return x
  const n = Math.floor(x / step + EPS)
  return Math.round(n * step * 1e6) / 1e6
}

/** Round to 2 decimals for display. */
export const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100

export const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi)

export const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
