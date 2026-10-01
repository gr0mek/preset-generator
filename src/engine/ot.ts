import { gaussian, type Rng } from './rng'

export interface SlicedOtOptions {
  iterations: number
  relaxation: number
  bins: number
  rng: Rng
  onIteration?: (i: number) => void
}

/** Random 3×3 orthonormal basis (rows), via Gram–Schmidt on Gaussian vectors. */
export function randomRotation(rng: Rng): Float64Array {
  const m = new Float64Array(9)
  for (;;) {
    for (let i = 0; i < 9; i++) m[i] = gaussian(rng)
    let ok = true
    for (let r = 0; r < 3 && ok; r++) {
      for (let q = 0; q < r; q++) {
        let d = 0
        for (let k = 0; k < 3; k++) d += m[r * 3 + k]! * m[q * 3 + k]!
        for (let k = 0; k < 3; k++) m[r * 3 + k]! -= d * m[q * 3 + k]!
      }
      const n = Math.hypot(m[r * 3]!, m[r * 3 + 1]!, m[r * 3 + 2]!)
      if (n < 1e-6) ok = false
      else for (let k = 0; k < 3; k++) m[r * 3 + k]! /= n
    }
    if (ok) return m
  }
}

/**
 * Builds a monotone 1D transport map (CDF matching) from `src` values to `ref` values,
 * evaluated at `bins + 1` evenly spaced edges over [lo, hi]. Returns mapped edge values.
 */
export function transport1D(
  src: Float64Array,
  ref: Float64Array,
  bins: number,
  lo: number,
  hi: number,
): Float64Array {
  const width = (hi - lo) / bins
  const cdf = (vals: Float64Array): Float64Array => {
    const h = new Float64Array(bins + 1)
    for (let i = 0; i < vals.length; i++) {
      let b = Math.floor((vals[i]! - lo) / width)
      if (b < 0) b = 0
      else if (b >= bins) b = bins - 1
      h[b + 1]! += 1
    }
    for (let b = 1; b <= bins; b++) h[b]! += h[b - 1]!
    const n = h[bins]!
    for (let b = 0; b <= bins; b++) h[b]! /= n
    return h
  }
  const cs = cdf(src)
  const cr = cdf(ref)
  const mapped = new Float64Array(bins + 1)
  let k = 0
  for (let e = 0; e <= bins; e++) {
    const c = cs[e]!
    while (k < bins - 1 && cr[k + 1]! < c) k++
    const c0 = cr[k]!
    const c1 = cr[k + 1]!
    const t = c1 > c0 ? Math.min(1, Math.max(0, (c - c0) / (c1 - c0))) : 0.5
    mapped[e] = lo + (k + t) * width
  }
  return mapped
}

/** Sliced-Wasserstein-style distance along fixed axes (diagnostics / tests). */
export function slicedDistance(a: Float32Array, b: Float32Array, rng: Rng, slices = 16): number {
  let total = 0
  const pa = new Float64Array(a.length / 3)
  const pb = new Float64Array(b.length / 3)
  for (let s = 0; s < slices; s++) {
    const R = randomRotation(rng)
    project(a, R, 0, pa)
    project(b, R, 0, pb)
    pa.sort()
    pb.sort()
    const n = 64
    for (let q = 0; q < n; q++) {
      const t = (q + 0.5) / n
      total += Math.abs(pa[Math.floor(t * pa.length)]! - pb[Math.floor(t * pb.length)]!)
    }
  }
  return total / (slices * 64)
}

function project(pts: Float32Array, R: Float64Array, row: number, out: Float64Array) {
  const u0 = R[row * 3]!
  const u1 = R[row * 3 + 1]!
  const u2 = R[row * 3 + 2]!
  for (let i = 0, j = 0; i < pts.length; i += 3, j++)
    out[j] = pts[i]! * u0 + pts[i + 1]! * u1 + pts[i + 2]! * u2
}

/**
 * Iterative distribution transfer (Pitié et al. 2005/2007): repeatedly match 1D marginals of
 * `points` to `ref` along random orthonormal bases. Mutates `points` in place.
 */
export function slicedOt(points: Float32Array, ref: Float32Array, opts: SlicedOtOptions): void {
  const np = points.length / 3
  const nr = ref.length / 3
  const pp = new Float64Array(np)
  const pr = new Float64Array(nr)
  for (let it = 0; it < opts.iterations; it++) {
    const R = randomRotation(opts.rng)
    for (let axis = 0; axis < 3; axis++) {
      project(points, R, axis, pp)
      project(ref, R, axis, pr)
      let lo = Infinity
      let hi = -Infinity
      for (const arr of [pp, pr])
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i]!
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      const pad = (hi - lo) * 1e-3 + 1e-9
      lo -= pad
      hi += pad
      const map = transport1D(pp, pr, opts.bins, lo, hi)
      const width = (hi - lo) / opts.bins
      const u0 = R[axis * 3]!
      const u1 = R[axis * 3 + 1]!
      const u2 = R[axis * 3 + 2]!
      for (let j = 0, i = 0; j < np; j++, i += 3) {
        const v = pp[j]!
        const f = (v - lo) / width
        let b = Math.floor(f)
        if (b >= opts.bins) b = opts.bins - 1
        const t = f - b
        const target = map[b]! * (1 - t) + map[b + 1]! * t
        const d = (target - v) * opts.relaxation
        points[i]! += d * u0
        points[i + 1]! += d * u1
        points[i + 2]! += d * u2
      }
    }
    opts.onIteration?.(it)
  }
}
