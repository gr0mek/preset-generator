import type { Lut3D } from '../engine/types'

/** Strip characters that would break the TITLE line. */
const safeTitle = (t: string) => t.replace(/["\r\n]/g, '').slice(0, 120)

/**
 * Adobe / Resolve .cube (Cube LUT Specification 1.0): R index changes fastest — same order as Lut3D.
 */
export function cubeText(lut: Lut3D): string {
  const lines: string[] = [
    `TITLE "${safeTitle(lut.meta.title)}"`,
    `# Created with Preset AI — ${lut.meta.createdAt}`,
    `LUT_3D_SIZE ${lut.size}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
  ]
  const d = lut.data
  for (let i = 0; i < d.length; i += 3) lines.push(`${fmt(d[i]!)} ${fmt(d[i + 1]!)} ${fmt(d[i + 2]!)}`)
  return lines.join('\n') + '\n'
}

export function toCube(lut: Lut3D): Blob {
  return new Blob([cubeText(lut)], { type: 'text/plain' })
}

const fmt = (v: number) => (v <= 0 ? '0.000000' : v >= 1 ? '1.000000' : v.toFixed(6))

export class CubeParseError extends Error {}

/** Minimal .cube parser (3D only) — used for round-trip tests and future LUT import. */
export function parseCube(text: string): { size: number; title?: string; data: Float32Array } {
  let size = 0
  let title: string | undefined
  const values: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('TITLE')) title = line.replace(/^TITLE\s+"?|"?$/g, '')
    else if (line.startsWith('LUT_3D_SIZE')) size = Number(line.split(/\s+/)[1])
    else if (line.startsWith('LUT_1D_SIZE')) throw new CubeParseError('1D LUTs are not supported')
    else if (/^(DOMAIN_MIN|DOMAIN_MAX|LUT_3D_INPUT_RANGE)/.test(line)) continue
    else {
      const parts = line.split(/\s+/).map(Number)
      if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v)))
        throw new CubeParseError(`Bad line: ${line}`)
      values.push(...parts)
    }
  }
  if (!size) throw new CubeParseError('Missing LUT_3D_SIZE')
  if (values.length !== size ** 3 * 3)
    throw new CubeParseError(`Expected ${size ** 3} entries, got ${values.length / 3}`)
  return { size, title, data: Float32Array.from(values) }
}
