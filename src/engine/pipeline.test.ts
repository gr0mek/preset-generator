import { filmLook, mapImage, scene, synthImage } from '../../test/synth'
import { maxSecondDiff, meanError, usedNodes } from '../../test/lutMetrics'
import { identityLut, sampleLut } from './lut'
import { computeLut } from './pipeline'
import type { PixelSource } from './types'

const target = synthImage(256, 256, scene)
const reference = mapImage(target, filmLook)

describe('computeLut', () => {
  const result = computeLut({ reference, target })

  it('produces a finite 33³ LUT within [0,1]', () => {
    expect(result.lut.size).toBe(33)
    expect(result.lut.data.length).toBe(33 ** 3 * 3)
    for (const v of result.lut.data) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('recovers a known non-linear film look (mean error < 2%)', () => {
    const before = meanError(identityLut(33), target, reference)
    const after = meanError(result.lut, target, reference)
    expect(after).toBeLessThan(0.02)
    expect(after).toBeLessThan(before * 0.35)
  })

  it('is smooth where the image lives and has no discontinuities anywhere', () => {
    // Ground truth curvature is ~0.001; residual kinks sit at the edge of the colour distribution.
    expect(maxSecondDiff(result.lut, usedNodes(target, 33))).toBeLessThan(0.08)
    // Whole cube includes per-channel clamping at the gamut edge — must stay a kink, never a jump.
    expect(maxSecondDiff(result.lut)).toBeLessThan(0.2)
  })

  it('same reference as target ⇒ near-identity LUT', () => {
    const r = computeLut({ reference: target, target })
    expect(meanError(r.lut, target, target)).toBeLessThan(0.01)
  })

  it('is deterministic for a given seed', () => {
    const again = computeLut({ reference, target })
    expect(again.lut.data).toEqual(result.lut.data)
  })

  it('falls back with a warning for a uniform reference', () => {
    const flat = synthImage(64, 64, () => [0.5, 0.45, 0.4])
    const r = computeLut({ reference: flat, target })
    expect(r.stats.usedFallback).toBe(true)
    expect(r.warnings.map((w) => w.code)).toContain('LOW_VARIANCE_REFERENCE')
  })

  it('handles a black & white reference (desaturates)', () => {
    const bw = mapImage(target, ([r, g, b]) => {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
      return [l, l, l]
    })
    const r = computeLut({ reference: bw, target })
    expect(r.stats.usedFallback).toBe(false)
    const out = new Float32Array(3)
    sampleLut(r.lut, 0.8, 0.3, 0.2, out)
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(0.06)
  })

  it('rejects images without enough opaque pixels', () => {
    const empty: PixelSource = { data: new Uint8ClampedArray(16 * 4), width: 4, height: 4 }
    expect(() => computeLut({ reference: empty, target })).toThrow(/Not enough/)
  })

  it('reports timings', () => {
    console.info('engine timings (ms):', JSON.stringify(result.stats.timingsMs))
  })
})
