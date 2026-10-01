import { invSqrtm3, meanCov, mul3, sqrtm3, type Mat3, type Vec3 } from './linalg'

/** Affine map x' = A (x − srcMean) + dstMean. */
export interface AffineMap {
  A: Mat3
  srcMean: Vec3
  dstMean: Vec3
}

const EPS = 1e-6

/**
 * Monge–Kantorovich linear transfer (Pitié & Kokaram 2007):
 * A = Σs^-½ (Σs^½ Σr Σs^½)^½ Σs^-½ — maps N(μs,Σs) onto N(μr,Σr) with minimal displacement.
 */
export function computeMkl(src: Float32Array, ref: Float32Array): AffineMap {
  const s = meanCov(src)
  const r = meanCov(ref)
  for (const c of [s.cov, r.cov]) {
    c[0]! += EPS
    c[4]! += EPS
    c[8]! += EPS
  }
  const sHalf = sqrtm3(s.cov)
  const sInvHalf = invSqrtm3(s.cov)
  const middle = sqrtm3(mul3(mul3(sHalf, r.cov), sHalf))
  const A = mul3(mul3(sInvHalf, middle), sInvHalf)
  return { A, srcMean: s.mean, dstMean: r.mean }
}

/** Reinhard-style diagonal transfer (per-channel mean/std) — fallback for degenerate references. */
export function computeDiagonal(src: Float32Array, ref: Float32Array, minStd = 1e-3): AffineMap {
  const s = meanCov(src)
  const r = meanCov(ref)
  const A = new Float64Array(9)
  for (let k = 0; k < 3; k++) {
    const ss = Math.sqrt(Math.max(s.cov[k * 4]!, 0))
    const rs = Math.sqrt(Math.max(r.cov[k * 4]!, 0))
    A[k * 4] = ss < minStd ? 1 : Math.min(rs / ss, 4)
  }
  return { A, srcMean: s.mean, dstMean: r.mean }
}

export function applyAffine(
  m: AffineMap,
  inp: ArrayLike<number>,
  i: number,
  out: Float32Array | Float64Array,
  o: number,
) {
  const x = inp[i]! - m.srcMean[0]!
  const y = inp[i + 1]! - m.srcMean[1]!
  const z = inp[i + 2]! - m.srcMean[2]!
  const A = m.A
  out[o] = A[0]! * x + A[1]! * y + A[2]! * z + m.dstMean[0]!
  out[o + 1] = A[3]! * x + A[4]! * y + A[5]! * z + m.dstMean[1]!
  out[o + 2] = A[6]! * x + A[7]! * y + A[8]! * z + m.dstMean[2]!
}

export function applyAffineAll(m: AffineMap, pts: Float32Array): Float32Array {
  const out = new Float32Array(pts.length)
  for (let i = 0; i < pts.length; i += 3) applyAffine(m, pts, i, out, i)
  return out
}
