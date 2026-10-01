import { computeMkl, applyAffineAll } from './mkl'
import { meanCov } from './linalg'
import { gaussian, mulberry32 } from './rng'

describe('MKL', () => {
  it('recovers a known symmetric positive-definite affine transform', () => {
    const rng = mulberry32(7)
    const n = 50_000
    const X = new Float32Array(n * 3)
    for (let i = 0; i < X.length; i++) X[i] = gaussian(rng) * [0.2, 0.05, 0.08][i % 3]!
    const T = [1.2, 0.1, 0, 0.1, 0.8, 0.05, 0, 0.05, 1.1]
    const off = [0.1, -0.02, 0.03]
    const Y = new Float32Array(n * 3)
    for (let i = 0; i < n; i++)
      for (let r = 0; r < 3; r++)
        Y[i * 3 + r] =
          T[r * 3]! * X[i * 3]! + T[r * 3 + 1]! * X[i * 3 + 1]! + T[r * 3 + 2]! * X[i * 3 + 2]! + off[r]!
    const m = computeMkl(X, Y)
    for (let i = 0; i < 9; i++) expect(Math.abs(m.A[i]! - T[i]!)).toBeLessThan(1e-3)
  })

  it('mapped cloud matches reference mean and covariance', () => {
    const rng = mulberry32(3)
    const mk = (s: number[], o: number[]) => {
      const p = new Float32Array(30_000 * 3)
      for (let i = 0; i < p.length; i++) p[i] = gaussian(rng) * s[i % 3]! + o[i % 3]!
      return p
    }
    const src = mk([0.2, 0.03, 0.04], [0.5, 0, 0])
    const ref = mk([0.1, 0.06, 0.02], [0.6, 0.02, -0.03])
    const out = meanCov(applyAffineAll(computeMkl(src, ref), src))
    const r = meanCov(ref)
    for (let i = 0; i < 3; i++) expect(out.mean[i]).toBeCloseTo(r.mean[i]!, 4)
    for (let i = 0; i < 9; i++) expect(Math.abs(out.cov[i]! - r.cov[i]!)).toBeLessThan(1e-4)
  })
})
