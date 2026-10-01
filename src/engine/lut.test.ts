import { applyStrength, identityLut, resampleLut, sampleLut } from './lut'

describe('LUT utilities', () => {
  it('identity LUT returns the input colour', () => {
    const lut = identityLut(17)
    const out = new Float32Array(3)
    sampleLut(lut, 0.123, 0.456, 0.789, out)
    expect(Array.from(out).map((v) => +v.toFixed(5))).toEqual([0.123, 0.456, 0.789])
  })

  it('strength 0 is identity, 1 is unchanged', () => {
    const lut = identityLut(9)
    const warm = { ...lut, data: lut.data.map((v, i) => (i % 3 === 0 ? Math.min(1, v + 0.1) : v)) }
    expect(applyStrength(warm, 0).data).toEqual(identityLut(9).data)
    expect(applyStrength(warm, 1).data).toEqual(warm.data)
  })

  it('resampling an identity LUT stays identity', () => {
    const r = resampleLut(identityLut(33), 17)
    const id = identityLut(17)
    for (let i = 0; i < r.data.length; i++) expect(r.data[i]).toBeCloseTo(id.data[i]!, 6)
  })
})
