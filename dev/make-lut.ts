/**
 * E4.12 harness — generate LUTs from real image pairs without the UI (for the M1 quality gate).
 *
 *   npm run lut -- <reference.jpg|png>[,<reference2>…] <target.jpg|png> [out-dir]
 *   npm run lut -- --batch test/fixtures/qa-pairs [out-dir]
 *       batch mode expects <name>_ref.(jpg|png) + <name>_target.(jpg|png) pairs
 *   --options='{"otIterations":0}'   override EngineOptions (any position; for E4.12 tuning)
 *
 * Writes <name>.cube and <name>_preview.jpg (target | graded target | reference) per pair.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import { computeLut } from '../src/engine/pipeline'
import { applyLutToPixels } from '../src/engine/lut'
import type { EngineOptions, PixelSource } from '../src/engine/types'
import { cubeText } from '../src/export/cube'

const ANALYSIS_EDGE = 512
const PREVIEW_EDGE = 900

function load(path: string): PixelSource {
  const buf = readFileSync(path)
  const ext = extname(path).toLowerCase()
  if (ext === '.png') {
    const png = PNG.sync.read(buf)
    return { data: new Uint8Array(png.data), width: png.width, height: png.height }
  }
  const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 })
  return { data: img.data, width: img.width, height: img.height }
}

/** Box-filter downscale so the long edge ≤ maxEdge. */
function downscale(src: PixelSource, maxEdge: number): PixelSource {
  const f = Math.max(1, Math.ceil(Math.max(src.width, src.height) / maxEdge))
  if (f === 1) return src
  const w = Math.floor(src.width / f)
  const h = Math.floor(src.height / f)
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0]
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const i = ((y * f + dy) * src.width + (x * f + dx)) * 4
          for (let c = 0; c < 4; c++) acc[c]! += src.data[i + c]!
        }
      for (let c = 0; c < 4; c++) data[(y * w + x) * 4 + c] = Math.round(acc[c]! / (f * f))
    }
  return { data, width: w, height: h }
}

function fitHeight(src: PixelSource, h: number): PixelSource {
  const w = Math.round((src.width * h) / src.height)
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w))
      const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h))
      data.set(src.data.subarray((sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4), (y * w + x) * 4)
    }
  return { data, width: w, height: h }
}

function sideBySide(images: PixelSource[]): PixelSource {
  const h = Math.min(...images.map((i) => i.height))
  const scaled = images.map((i) => fitHeight(i, h))
  const width = scaled.reduce((a, i) => a + i.width, 0)
  const data = new Uint8Array(width * h * 4)
  let x0 = 0
  for (const img of scaled) {
    for (let y = 0; y < h; y++)
      data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), (y * width + x0) * 4)
    x0 += img.width
  }
  return { data, width, height: h }
}

function processPair(name: string, refPath: string, tgtPath: string, outDir: string) {
  const refs = refPath.split(',').map(load)
  const ref = refs[0]!
  const tgt = load(tgtPath)
  const t0 = performance.now()
  const res = computeLut({
    reference: refs.map((r) => downscale(r, ANALYSIS_EDGE)),
    target: downscale(tgt, ANALYSIS_EDGE),
    options,
    meta: { title: `Preset AI — ${name}`, sourceRef: basename(refPath.split(',')[0]!) },
  })
  const ms = Math.round(performance.now() - t0)
  writeFileSync(join(outDir, `${name}.cube`), cubeText(res.lut))
  const prevT = downscale(tgt, PREVIEW_EDGE)
  const graded = { ...prevT, data: new Uint8Array(prevT.data.length) }
  applyLutToPixels(res.lut, prevT.data, graded.data)
  const sheet = sideBySide([prevT, graded, downscale(ref, PREVIEW_EDGE)])
  writeFileSync(join(outDir, `${name}_preview.jpg`), jpeg.encode(sheet, 88).data)
  console.log(`${name}: ${ms} ms, warnings: ${res.warnings.map((w) => w.code).join(', ') || 'none'}`)
}

const OPTIONS_FLAG = '--options='
const argv = process.argv.slice(2)
const optionsArg = argv.find((a) => a.startsWith(OPTIONS_FLAG))
const options = optionsArg
  ? (JSON.parse(optionsArg.slice(OPTIONS_FLAG.length)) as Partial<EngineOptions>)
  : undefined
const args = argv.filter((a) => a !== optionsArg)
if (args[0] === '--batch') {
  const dir = args[1] ?? 'test/fixtures/qa-pairs'
  const out = args[2] ?? 'out/qa'
  mkdirSync(out, { recursive: true })
  const files = readdirSync(dir)
  for (const f of files.filter((f) => /_ref\.(jpe?g|png)$/i.test(f))) {
    const name = f.replace(/_ref\.(jpe?g|png)$/i, '')
    const tgt = files.find((g) => new RegExp(`^${name}_target\\.(jpe?g|png)$`, 'i').test(g))
    if (!tgt) {
      console.warn(`skip ${name}: no _target file`)
      continue
    }
    processPair(name, join(dir, f), join(dir, tgt), out)
  }
} else if (args.length >= 2) {
  const out = args[2] ?? 'out'
  mkdirSync(out, { recursive: true })
  processPair(basename(args[1]!, extname(args[1]!)), args[0]!, args[1]!, out)
} else {
  console.error(
    'usage: npm run lut -- <reference> <target> [out-dir]  |  npm run lut -- --batch <dir> [out-dir]',
  )
  process.exit(1)
}
