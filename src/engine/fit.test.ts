import { blur3, fitLut, gaussianKernel } from './fit'
import { identityLut } from './lut'

describe('fitLut', () => {
  it('gaussian kernel is normalised', () => {
    expect(gaussianKernel(1.3).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  })

  it('blur keeps a constant field constant in the interior', () => {
    const N = 9
    const f = new Float64Array(N ** 3).fill(2)
    blur3(f, N, 1, gaussianKernel(0.8))
    expect(f[4 + 9 * 4 + 81 * 4]).toBeCloseTo(2, 6)
  })

  it('reproduces data that already matches the prior (zero residual)', () => {
    const N = 9
    const prior = Float64Array.from(identityLut(N).data)
    const inputs = Float32Array.from({ length: 3000 }, (_, i) => ((i * 7919) % 1000) / 999)
    const res = fitLut({ inputs, targets: inputs, prior, size: N, sigma: 1, priorWeight: 0.05, passes: 2 })
    for (let i = 0; i < prior.length; i++) expect(res.nodes[i]).toBeCloseTo(prior[i]!, 6)
  })

  it('moves towards the data where samples exist and stays at the prior far away', () => {
    const N = 17
    const prior = Float64Array.from(identityLut(N).data)
    // samples only in the dark corner, all asking for +0.1 on red
    const n = 2000
    const inputs = new Float32Array(n * 3)
    const targets = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = 0.05 + (0.1 * ((i * 31) % 100)) / 100
      inputs.set([v, v, v], i * 3)
      targets.set([v + 0.1, v, v], i * 3)
    }
    const res = fitLut({ inputs, targets, prior, size: N, sigma: 1, priorWeight: 0.05, passes: 3 })
    const at = (r: number, g: number, b: number) => res.nodes[(r + N * (g + N * b)) * 3]! - r / (N - 1)
    expect(at(2, 2, 2)).toBeGreaterThan(0.08) // follows data
    expect(Math.abs(at(16, 16, 16))).toBeLessThan(0.1) // bounded far away
  })
})
