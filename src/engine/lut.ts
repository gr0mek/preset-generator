import type { Lut3D, LutMeta } from './types'

export const lutNodeCount = (size: number) => size * size * size
/** Flat node index, R fastest (ADR-003). */
export const lutIndex = (size: number, r: number, g: number, b: number) => r + size * (g + size * b)

const defaultMeta = (): LutMeta => ({ title: 'Preset AI', createdAt: new Date().toISOString() })

export function identityLut(size: number, meta: LutMeta = defaultMeta()): Lut3D {
  const data = new Float32Array(lutNodeCount(size) * 3)
  const d = size - 1
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const i = lutIndex(size, r, g, b) * 3
        data[i] = r / d
        data[i + 1] = g / d
        data[i + 2] = b / d
      }
  return { size, data, meta }
}

/** Trilinear lookup of an sRGB colour in [0,1]³. Reference CPU implementation (preview fallback + tests). */
export function sampleLut(
  lut: Lut3D,
  r: number,
  g: number,
  b: number,
  out: Float32Array | Float64Array,
  o = 0,
): void {
  const n = lut.size
  const d = n - 1
  const fr = clamp01(r) * d
  const fg = clamp01(g) * d
  const fb = clamp01(b) * d
  const r0 = Math.min(Math.floor(fr), d - 1)
  const g0 = Math.min(Math.floor(fg), d - 1)
  const b0 = Math.min(Math.floor(fb), d - 1)
  const tr = fr - r0
  const tg = fg - g0
  const tb = fb - b0
  const data = lut.data
  for (let c = 0; c < 3; c++) {
    const at = (dr: number, dg: number, db: number) => data[lutIndex(n, r0 + dr, g0 + dg, b0 + db) * 3 + c]!
    const c00 = at(0, 0, 0) * (1 - tr) + at(1, 0, 0) * tr
    const c10 = at(0, 1, 0) * (1 - tr) + at(1, 1, 0) * tr
    const c01 = at(0, 0, 1) * (1 - tr) + at(1, 0, 1) * tr
    const c11 = at(0, 1, 1) * (1 - tr) + at(1, 1, 1) * tr
    const c0 = c00 * (1 - tg) + c10 * tg
    const c1 = c01 * (1 - tg) + c11 * tg
    out[o + c] = c0 * (1 - tb) + c1 * tb
  }
}

/** Apply a LUT to RGBA8 pixels (CPU). */
export function applyLutToPixels(
  lut: Lut3D,
  src: Uint8ClampedArray | Uint8Array,
  dst: Uint8ClampedArray | Uint8Array,
) {
  const tmp = new Float32Array(3)
  for (let i = 0; i < src.length; i += 4) {
    sampleLut(lut, src[i]! / 255, src[i + 1]! / 255, src[i + 2]! / 255, tmp)
    dst[i] = Math.round(clamp01(tmp[0]!) * 255)
    dst[i + 1] = Math.round(clamp01(tmp[1]!) * 255)
    dst[i + 2] = Math.round(clamp01(tmp[2]!) * 255)
    dst[i + 3] = src[i + 3]!
  }
}

/** lerp(identity, lut, strength). strength ∈ [0,1]; values >1 extrapolate (clamped to [0,1] output). */
export function applyStrength(lut: Lut3D, strength: number): Lut3D {
  const id = identityLut(lut.size, lut.meta)
  const data = new Float32Array(lut.data.length)
  for (let i = 0; i < data.length; i++)
    data[i] = clamp01(id.data[i]! + (lut.data[i]! - id.data[i]!) * strength)
  return { size: lut.size, data, meta: lut.meta }
}

/** Resample to another grid size (trilinear). */
export function resampleLut(lut: Lut3D, size: number): Lut3D {
  if (size === lut.size) return lut
  const data = new Float32Array(lutNodeCount(size) * 3)
  const d = size - 1
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) sampleLut(lut, r / d, g / d, b / d, data, lutIndex(size, r, g, b) * 3)
  return { size, data, meta: lut.meta }
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
