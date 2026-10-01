import { lutIndex, lutNodeCount } from './lut'

export interface FitInput {
  /** n×3 LUT input coordinates (sRGB, [0,1]). */
  inputs: Float32Array
  /** n×3 desired outputs (sRGB, same space as prior). */
  targets: Float32Array
  /** nodes×3 prior outputs at each grid node. */
  prior: Float64Array
  size: number
  /** Gaussian kernel width in grid nodes — larger = smoother LUT. */
  sigma: number
  /** Pull towards the prior where data is sparse, relative to the mean sample density per node. */
  priorWeight: number
  /** Residual-correction passes (≥1). Each pass re-fits what the previous passes missed. */
  passes: number
}

export interface FitResult {
  /** nodes×3 fitted outputs (unclamped). */
  nodes: Float64Array
  /** Per-node (blurred) data density — ~0 where no sample is near the node. */
  support: Float64Array
}

/**
 * Smooth scattered-data fit by normalized convolution (Knutsson & Westin):
 *   residual(node) = K * Σ w·(y − LUT(x))  /  (K * Σ w + ε)
 * with trilinear splat weights w and a heavy-tailed kernel K (sum of separable Gaussians). Where samples are dense the LUT follows
 * the data; where they are sparse it fades smoothly into the prior (ε). Smooth by construction, O(nodes),
 * no iterative solver. A few correction passes recover detail lost to the blur.
 */
export function fitLut(f: FitInput): FitResult {
  const N = f.size
  const nodes = lutNodeCount(N)
  const n = f.inputs.length / 3
  const d = N - 1
  const x = Float64Array.from(f.prior)
  const num = new Float64Array(nodes * 3)
  const den = new Float64Array(nodes)
  const eps = f.priorWeight * Math.max(n / nodes, 1e-9)
  // Heavy-tailed kernel = Σ κ^k · G(σ·4^k): local detail where data is dense, smooth residual
  // extrapolation (instead of a cliff back to the prior) where it is sparse.
  const scales = [f.sigma, f.sigma * 4, f.sigma * 16].map(gaussianKernel)
  const weights = [1, TAIL, TAIL * TAIL]
  const numB = new Float64Array(nodes * 3)
  const denB = new Float64Array(nodes)
  const idx = new Int32Array(8)
  const w = new Float64Array(8)

  let support = new Float64Array(nodes)
  for (let pass = 0; pass < Math.max(1, f.passes); pass++) {
    num.fill(0)
    den.fill(0)
    for (let s = 0; s < n; s++) {
      const fr = f.inputs[s * 3]! * d
      const fg = f.inputs[s * 3 + 1]! * d
      const fb = f.inputs[s * 3 + 2]! * d
      const r0 = Math.min(Math.max(Math.floor(fr), 0), d - 1)
      const g0 = Math.min(Math.max(Math.floor(fg), 0), d - 1)
      const b0 = Math.min(Math.max(Math.floor(fb), 0), d - 1)
      const tr = fr - r0
      const tg = fg - g0
      const tb = fb - b0
      let k = 0
      for (let db = 0; db < 2; db++)
        for (let dg = 0; dg < 2; dg++)
          for (let dr = 0; dr < 2; dr++, k++) {
            idx[k] = lutIndex(N, r0 + dr, g0 + dg, b0 + db)
            w[k] = (dr ? tr : 1 - tr) * (dg ? tg : 1 - tg) * (db ? tb : 1 - tb)
          }
      for (let c = 0; c < 3; c++) {
        let v = 0
        for (let a = 0; a < 8; a++) v += w[a]! * x[idx[a]! * 3 + c]!
        const resid = f.targets[s * 3 + c]! - v
        for (let a = 0; a < 8; a++) num[idx[a]! * 3 + c]! += w[a]! * resid
      }
      for (let a = 0; a < 8; a++) den[idx[a]!]! += w[a]!
    }
    const numAcc = new Float64Array(nodes * 3)
    const denAcc = new Float64Array(nodes)
    for (let k = 0; k < scales.length; k++) {
      numB.set(num)
      denB.set(den)
      blur3(numB, N, 3, scales[k]!)
      blur3(denB, N, 1, scales[k]!)
      if (pass === 0 && k === 0) support = Float64Array.from(denB)
      const wk = weights[k]!
      for (let i = 0; i < nodes * 3; i++) numAcc[i]! += wk * numB[i]!
      for (let i = 0; i < nodes; i++) denAcc[i]! += wk * denB[i]!
    }
    for (let i = 0; i < nodes; i++) {
      const q = 1 / (denAcc[i]! + eps)
      x[i * 3]! += numAcc[i * 3]! * q
      x[i * 3 + 1]! += numAcc[i * 3 + 1]! * q
      x[i * 3 + 2]! += numAcc[i * 3 + 2]! * q
    }
  }
  return { nodes: x, support }
}

/** Weight ratio between successive kernel scales. */
const TAIL = 0.05

export function gaussianKernel(sigma: number): Float64Array {
  const radius = Math.max(1, Math.ceil(sigma * 3))
  const k = new Float64Array(radius * 2 + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) sum += k[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i]! /= sum
  return k
}

/** In-place separable blur of an N³ grid with `ch` interleaved channels (zero padding). */
export function blur3(field: Float64Array, N: number, ch: number, kernel: Float64Array): void {
  const radius = (kernel.length - 1) / 2
  const line = new Float64Array(N * ch)
  const strides = [1, N, N * N]
  for (const stride of strides) {
    // iterate over all lines along this axis
    for (let a = 0; a < N; a++)
      for (let b = 0; b < N; b++) {
        const start = stride === 1 ? a * N + b * N * N : stride === N ? a + b * N * N : a + b * N
        for (let i = 0; i < N; i++)
          for (let c = 0; c < ch; c++) line[i * ch + c] = field[(start + i * stride) * ch + c]!
        for (let i = 0; i < N; i++)
          for (let c = 0; c < ch; c++) {
            let s = 0
            for (let k = -radius; k <= radius; k++) {
              const j = i + k
              if (j >= 0 && j < N) s += kernel[k + radius]! * line[j * ch + c]!
            }
            field[(start + i * stride) * ch + c] = s
          }
      }
  }
}
