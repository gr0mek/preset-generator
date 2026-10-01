import { linearToOklab, linearToSrgb, oklabToLinear, srgbToLinear } from './color'
import { mulberry32 } from './rng'

describe('color', () => {
  it('sRGB transfer round-trips', () => {
    for (let i = 0; i <= 1000; i++) expect(linearToSrgb(srgbToLinear(i / 1000))).toBeCloseTo(i / 1000, 9)
  })

  it('Oklab round-trips within 1e-5 on 1e5 random colours', () => {
    const rng = mulberry32(1)
    const c = new Float64Array(3)
    const lab = new Float64Array(3)
    const back = new Float64Array(3)
    let maxErr = 0
    for (let i = 0; i < 100_000; i++) {
      c[0] = rng()
      c[1] = rng()
      c[2] = rng()
      linearToOklab(c, 0, lab, 0)
      oklabToLinear(lab, 0, back, 0)
      for (let k = 0; k < 3; k++) maxErr = Math.max(maxErr, Math.abs(back[k]! - c[k]!))
    }
    expect(maxErr).toBeLessThan(1e-5)
  })

  it('maps white to L=1 and black to L=0 with neutral chroma', () => {
    const lab = new Float64Array(3)
    linearToOklab([1, 1, 1], 0, lab, 0)
    expect(lab[0]).toBeCloseTo(1, 4)
    expect(Math.abs(lab[1]!) + Math.abs(lab[2]!)).toBeLessThan(1e-4)
  })
})
