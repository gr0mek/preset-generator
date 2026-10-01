import { linearToOklab, srgb8ToLinear } from './color'
import type { PixelSource } from './types'

export interface Samples {
  /** n×3 sRGB in [0,1] (input coordinates for the LUT). */
  srgb: Float32Array
  /** n×3 Oklab. */
  oklab: Float32Array
  count: number
}

const L_MIN = 0.02
const L_MAX = 0.98

/**
 * Deterministic strided sampling. Skips transparent pixels and, for statistics,
 * clipped extremes (Oklab L outside [0.02, 0.98]). If masking would remove >90%
 * of pixels the mask is dropped (e.g. an intentionally crushed/high-key image).
 */
export function extractSamples(src: PixelSource, maxSamples: number): Samples {
  const total = src.width * src.height
  const stride = Math.max(1, Math.ceil(total / maxSamples))
  const cap = Math.ceil(total / stride)
  const tmp = new Float64Array(3)
  const lab = new Float64Array(3)

  const pass = (masked: boolean): Samples => {
    const srgb = new Float32Array(cap * 3)
    const oklab = new Float32Array(cap * 3)
    let n = 0
    for (let p = 0; p < total; p += stride) {
      const i = p * 4
      if (src.data[i + 3]! < 128) continue
      const r = src.data[i]!
      const g = src.data[i + 1]!
      const b = src.data[i + 2]!
      tmp[0] = srgb8ToLinear(r)
      tmp[1] = srgb8ToLinear(g)
      tmp[2] = srgb8ToLinear(b)
      linearToOklab(tmp, 0, lab, 0)
      if (masked && (lab[0]! < L_MIN || lab[0]! > L_MAX)) continue
      srgb[n * 3] = r / 255
      srgb[n * 3 + 1] = g / 255
      srgb[n * 3 + 2] = b / 255
      oklab[n * 3] = lab[0]!
      oklab[n * 3 + 1] = lab[1]!
      oklab[n * 3 + 2] = lab[2]!
      n++
    }
    return { srgb: srgb.subarray(0, n * 3), oklab: oklab.subarray(0, n * 3), count: n }
  }

  const masked = pass(true)
  if (masked.count >= cap * 0.1) return masked
  return pass(false)
}
