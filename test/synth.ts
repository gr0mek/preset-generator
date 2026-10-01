import type { PixelSource } from '../src/engine/types'

export type RGB = [number, number, number]

/** Build an RGBA8 image from a per-pixel function returning sRGB in [0,1]. */
export function synthImage(width: number, height: number, fn: (x: number, y: number) => RGB): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x / (width - 1), y / (height - 1))
      const i = (y * width + x) * 4
      data[i] = Math.round(r * 255)
      data[i + 1] = Math.round(g * 255)
      data[i + 2] = Math.round(b * 255)
      data[i + 3] = 255
    }
  return { data, width, height }
}

/** A "natural-ish" colourful scene: gradients + soft blobs, deterministic. */
export const scene = (x: number, y: number): RGB => {
  const blob = (cx: number, cy: number, r: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r))
  const r = 0.15 + 0.6 * x + 0.25 * blob(0.3, 0.3, 0.15)
  const g = 0.2 + 0.5 * y + 0.2 * blob(0.7, 0.4, 0.2) - 0.1 * blob(0.2, 0.8, 0.1)
  const b = 0.25 + 0.35 * (1 - x) * y + 0.3 * blob(0.6, 0.8, 0.18)
  return [clamp(r), clamp(g), clamp(b)]
}

/** A known non-linear "film look": S-curve, teal shadows, warm highlights. */
export const filmLook = ([r, g, b]: RGB): RGB => {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const s = (v: number) => clamp(v + 0.25 * (v - 0.5) * (1 - Math.abs(2 * v - 1)))
  const shadow = 1 - l
  return [
    clamp(s(r) * (1 + 0.12 * l) - 0.05 * shadow),
    clamp(s(g) + 0.02 * shadow),
    clamp(s(b) * (1 - 0.15 * l) + 0.06 * shadow),
  ]
}

export const clamp = (v: number) => Math.min(1, Math.max(0, v))

export function mapImage(src: PixelSource, fn: (c: RGB) => RGB): PixelSource {
  const data = new Uint8ClampedArray(src.data.length)
  for (let i = 0; i < src.data.length; i += 4) {
    const [r, g, b] = fn([src.data[i]! / 255, src.data[i + 1]! / 255, src.data[i + 2]! / 255])
    data[i] = Math.round(r * 255)
    data[i + 1] = Math.round(g * 255)
    data[i + 2] = Math.round(b * 255)
    data[i + 3] = 255
  }
  return { data, width: src.width, height: src.height }
}
