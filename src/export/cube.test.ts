import { applyStrength, identityLut } from '../engine/lut'
import { computeLut } from '../engine/pipeline'
import { filmLook, mapImage, scene, synthImage } from '../../test/synth'
import { cubeText, parseCube } from './cube'
import { presetFilename } from './filename'

describe('.cube export', () => {
  it('writes header and size³ rows, R fastest', () => {
    const text = cubeText(identityLut(2, { title: 'Test "quoted"', createdAt: 'x' }))
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('TITLE "Test quoted"')
    expect(lines).toContain('LUT_3D_SIZE 2')
    const rows = lines.filter((l) => /^[\d.]+ [\d.]+ [\d.]+$/.test(l))
    expect(rows).toEqual([
      '0.000000 0.000000 0.000000',
      '1.000000 0.000000 0.000000',
      '0.000000 1.000000 0.000000',
      '1.000000 1.000000 0.000000',
      '0.000000 0.000000 1.000000',
      '1.000000 0.000000 1.000000',
      '0.000000 1.000000 1.000000',
      '1.000000 1.000000 1.000000',
    ])
  })

  it('round-trips an engine LUT within quantisation (1e-6)', () => {
    const target = synthImage(128, 128, scene)
    const { lut } = computeLut({ reference: mapImage(target, filmLook), target })
    const baked = applyStrength(lut, 0.75)
    const parsed = parseCube(cubeText(baked))
    expect(parsed.size).toBe(33)
    for (let i = 0; i < baked.data.length; i++)
      expect(Math.abs(parsed.data[i]! - baked.data[i]!)).toBeLessThan(1e-6)
  })

  it('rejects malformed files', () => {
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n')).toThrow(/Expected 8/)
    expect(() => parseCube('0 0 0')).toThrow(/Missing/)
  })
})

describe('presetFilename', () => {
  it('slugs Polish characters and spaces', () => {
    expect(presetFilename('Zażółć gęślą JAŹŃ.jpg', 'cube', new Date(2026, 9, 1))).toBe(
      'presetai_zazolc-gesla-jazn_20261001.cube',
    )
    expect(presetFilename(undefined, 'xmp', new Date(2026, 0, 5))).toBe('presetai_look_20260105.xmp')
  })
})
