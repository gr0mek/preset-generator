import { slicedDistance, slicedOt, transport1D } from './ot'
import { gaussian, mulberry32 } from './rng'

const cloud = (seed: number, f: (rng: () => number) => [number, number, number], n = 20_000) => {
  const rng = mulberry32(seed)
  const p = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) p.set(f(rng), i * 3)
  return p
}

describe('sliced OT', () => {
  it('1D transport maps uniform[0,1] onto uniform[2,3]', () => {
    const src = Float64Array.from({ length: 10_000 }, (_, i) => i / 9999)
    const ref = Float64Array.from({ length: 10_000 }, (_, i) => 2 + i / 9999)
    const map = transport1D(src, ref, 256, -0.01, 3.01)
    // edge at value 0.5 → ~2.5
    const e = Math.round(((0.5 + 0.01) / 3.02) * 256)
    expect(map[e]).toBeCloseTo(2.5, 1)
  })

  it('reduces distance to a non-Gaussian (bimodal) reference and is deterministic', () => {
    const src = cloud(1, (r) => [gaussian(r) * 0.1 + 0.5, gaussian(r) * 0.05, gaussian(r) * 0.05])
    const ref = cloud(2, (r) => {
      const m = r() < 0.5 ? -0.08 : 0.08
      return [gaussian(r) * 0.05 + 0.6, m + gaussian(r) * 0.02, -m + gaussian(r) * 0.02]
    })
    const before = slicedDistance(src, ref, mulberry32(9))
    const a = src.slice()
    const b = src.slice()
    slicedOt(a, ref, { iterations: 12, relaxation: 0.8, bins: 512, rng: mulberry32(42) })
    slicedOt(b, ref, { iterations: 12, relaxation: 0.8, bins: 512, rng: mulberry32(42) })
    const after = slicedDistance(a, ref, mulberry32(9))
    expect(after).toBeLessThan(before * 0.15)
    expect(a).toEqual(b)
  })
})
