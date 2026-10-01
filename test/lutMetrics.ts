import { lutIndex, sampleLut } from '../src/engine/lut'
import type { Lut3D, PixelSource } from '../src/engine/types'

/** Nodes of the cells touched by image pixels (the region where the LUT is actually used). */
export function usedNodes(img: PixelSource, N: number): Uint8Array {
  const used = new Uint8Array(N * N * N)
  const d = N - 1
  for (let i = 0; i < img.data.length; i += 4) {
    const c = [0, 1, 2].map((k) => Math.min(Math.floor((img.data[i + k]! / 255) * d), d - 1))
    for (let db = 0; db < 2; db++)
      for (let dg = 0; dg < 2; dg++)
        for (let dr = 0; dr < 2; dr++) used[lutIndex(N, c[0]! + dr, c[1]! + dg, c[2]! + db)] = 1
  }
  return used
}

/** Largest second difference along any axis, optionally restricted to a node mask. */
export function maxSecondDiff(lut: Lut3D, mask?: Uint8Array): number {
  const N = lut.size
  let m = 0
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ] as const
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 0; r < N; r++)
        for (const [ar, ag, ab] of axes) {
          if (r - ar < 0 || g - ag < 0 || b - ab < 0 || r + ar >= N || g + ag >= N || b + ab >= N) continue
          const i0 = lutIndex(N, r - ar, g - ag, b - ab)
          const i1 = lutIndex(N, r, g, b)
          const i2 = lutIndex(N, r + ar, g + ag, b + ab)
          if (mask && !(mask[i0] && mask[i1] && mask[i2])) continue
          for (let c = 0; c < 3; c++)
            m = Math.max(
              m,
              Math.abs(lut.data[i0 * 3 + c]! - 2 * lut.data[i1 * 3 + c]! + lut.data[i2 * 3 + c]!),
            )
        }
  return m
}

/** Mean absolute error (0–1) between LUT(target) and the reference image, per channel. */
export function meanError(lut: Lut3D, tgt: PixelSource, ref: PixelSource): number {
  const out = new Float32Array(3)
  let err = 0
  for (let i = 0; i < tgt.data.length; i += 4) {
    sampleLut(lut, tgt.data[i]! / 255, tgt.data[i + 1]! / 255, tgt.data[i + 2]! / 255, out)
    for (let c = 0; c < 3; c++) err += Math.abs(out[c]! - ref.data[i + c]! / 255)
  }
  return err / ((tgt.data.length / 4) * 3)
}
