// sRGB transfer + Oklab (Björn Ottosson, 2020). All functions are allocation-free.

export function srgbToLinear(c: number): number {
  const a = Math.abs(c)
  const v = a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4)
  return c < 0 ? -v : v
}

export function linearToSrgb(c: number): number {
  const a = Math.abs(c)
  const v = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055
  return c < 0 ? -v : v
}

/** linear sRGB (in[i..i+2]) → Oklab (out[o..o+2]). in/out may alias. */
export function linearToOklab(
  inp: ArrayLike<number>,
  i: number,
  out: Float32Array | Float64Array,
  o: number,
): void {
  const r = inp[i]!
  const g = inp[i + 1]!
  const b = inp[i + 2]!
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

/** Oklab (in[i..i+2]) → linear sRGB (out[o..o+2]). in/out may alias. */
export function oklabToLinear(
  inp: ArrayLike<number>,
  i: number,
  out: Float32Array | Float64Array,
  o: number,
): void {
  const L = inp[i]!
  const A = inp[i + 1]!
  const B = inp[i + 2]!
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  out[o] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  out[o + 1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  out[o + 2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
}

const SRGB8_TO_LINEAR = new Float64Array(256)
for (let i = 0; i < 256; i++) SRGB8_TO_LINEAR[i] = srgbToLinear(i / 255)

export function srgb8ToLinear(v: number): number {
  return SRGB8_TO_LINEAR[v]!
}

/** sRGB [0,1] triplet → Oklab, via scratch buffer. */
export function srgbToOklab(
  r: number,
  g: number,
  b: number,
  out: Float64Array | Float32Array,
  o: number,
): void {
  const tmp = scratch
  tmp[0] = srgbToLinear(r)
  tmp[1] = srgbToLinear(g)
  tmp[2] = srgbToLinear(b)
  linearToOklab(tmp, 0, out, o)
}
const scratch = new Float64Array(3)
