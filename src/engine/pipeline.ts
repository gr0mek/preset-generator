import { linearToSrgb, oklabToLinear, srgbToOklab } from './color'
import { fitLut } from './fit'
import { estimateLook, applyLook, LOOK_STRENGTH_RANGE } from './look'
import { lutIndex, lutNodeCount } from './lut'
import { meanCov } from './linalg'
import { applyAffine, applyAffineAll, computeDiagonal, computeMkl, type AffineMap } from './mkl'
import { slicedOt } from './ot'
import { mulberry32 } from './rng'
import { extractSamples, type Samples } from './samples'
import {
  DEFAULT_ENGINE_OPTIONS,
  EngineError,
  type EngineOptions,
  type EngineResult,
  type EngineStage,
  type EngineWarning,
  type LutMeta,
  type PixelSource,
  type ProgressFn,
} from './types'

/** Below this Oklab-L standard deviation an image is treated as (near) uniform. */
const MIN_L_STD = 0.02
const SUPPORT_EPS = 1e-3

export interface ComputeLutArgs {
  /** One reference, or several frames sharing the look (consistent traits are kept, ADR-006). */
  reference: PixelSource | readonly PixelSource[]
  target: PixelSource
  options?: Partial<EngineOptions>
  meta?: Partial<LutMeta>
  onProgress?: ProgressFn
  /** Checked between stages; throw ABORTED when it returns true. */
  isCancelled?: () => boolean
}

export function computeLut(args: ComputeLutArgs): EngineResult {
  const o: EngineOptions = { ...DEFAULT_ENGINE_OPTIONS, ...args.options }
  validateOptions(o)
  const progress = args.onProgress ?? (() => {})
  const timings = {} as Record<EngineStage, number>
  const warnings: EngineWarning[] = []
  let t0 = now()
  const stage = (s: EngineStage) => {
    if (args.isCancelled?.()) throw new EngineError('ABORTED')
    const t = now()
    timings[s] = t - t0
    t0 = t
  }

  // 1. samples
  progress('samples', 0)
  const sources = Array.isArray(args.reference) ? args.reference : [args.reference as PixelSource]
  if (sources.length === 0) throw new EngineError('EMPTY_IMAGE', 'No reference image')
  // split the sample budget so several references cost about as much as one
  const perRef = Math.max(4096, Math.floor(o.maxSamples / sources.length))
  const refs = sources.map((src) => extractSamples(src, perRef))
  const ref = poolSamples(refs)
  const tgt = extractSamples(args.target, o.maxSamples)
  if (refs.some((r) => r.count < 16) || tgt.count < 16)
    throw new EngineError('EMPTY_IMAGE', 'Not enough opaque pixels')
  stage('samples')

  const refL = Math.sqrt(meanCov(ref.oklab).cov[0]!)
  const tgtL = Math.sqrt(meanCov(tgt.oklab).cov[0]!)
  const usedFallback = refL < MIN_L_STD
  if (usedFallback) warnings.push({ code: 'LOW_VARIANCE_REFERENCE' })
  if (tgtL < MIN_L_STD) warnings.push({ code: 'LOW_VARIANCE_TARGET' })

  const N = o.lutSize
  const nodes = lutNodeCount(N)
  const { values, support } =
    o.mode === 'look'
      ? lookNodes(
          refs.map((r) => r.oklab),
          tgt,
          N,
          usedFallback,
          o.lookStrength,
          progress,
          stage,
        )
      : transferNodes(ref.oklab, tgt, o, usedFallback, progress, stage)

  // 5. clamp, validate
  progress('finalize', 0)
  const data = new Float32Array(nodes * 3)
  let supported = 0
  let supportedClipped = 0
  for (let i = 0; i < nodes; i++) {
    let clipped = false
    for (let c = 0; c < 3; c++) {
      const v = values[i * 3 + c]!
      if (!Number.isFinite(v)) throw new EngineError('NUMERIC_FAILURE', 'Non-finite LUT value')
      if (v < -0.02 || v > 1.02) clipped = true
      data[i * 3 + c] = v < 0 ? 0 : v > 1 ? 1 : v
    }
    if (support[i]! > SUPPORT_EPS) {
      supported++
      if (clipped) supportedClipped++
    }
  }
  if (supported > 0 && supportedClipped / supported > 0.05)
    warnings.push({
      code: 'GAMUT_CLIPPED',
      detail: `${((supportedClipped / supported) * 100).toFixed(1)}% of used nodes`,
    })
  if (!greyAxisMonotonic(data, N)) warnings.push({ code: 'TONE_INVERSION' })
  stage('finalize')
  progress('finalize', 1)

  return {
    lut: {
      size: N,
      data,
      meta: {
        title: args.meta?.title ?? 'Preset AI',
        sourceRef: args.meta?.sourceRef,
        createdAt: args.meta?.createdAt ?? new Date().toISOString(),
      },
    },
    warnings,
    stats: {
      refSamples: ref.count,
      targetSamples: tgt.count,
      timingsMs: timings,
      usedFallback,
    },
  }
}

type StageFn = (s: EngineStage) => void
interface NodeValues {
  /** Unclamped sRGB per node. */
  values: ArrayLike<number>
  /** >0 where the target's colours constrain the node. */
  support: ArrayLike<number>
}

/** ADR-002/004: distribution transfer (MKL + sliced-OT) fitted onto the grid. */
function transferNodes(
  refLab: Float32Array,
  tgt: Samples,
  o: EngineOptions,
  usedFallback: boolean,
  progress: ProgressFn,
  stage: StageFn,
): NodeValues {
  progress('mkl', 0)
  const prior: AffineMap = usedFallback ? computeDiagonal(tgt.oklab, refLab) : computeMkl(tgt.oklab, refLab)
  const moved = applyAffineAll(prior, tgt.oklab)
  stage('mkl')

  // 3. non-linear residual transport
  if (!usedFallback && o.otIterations > 0) {
    slicedOt(moved, refLab, {
      iterations: o.otIterations,
      relaxation: o.otRelaxation,
      bins: o.otBins,
      rng: mulberry32(o.seed),
      onIteration: (i) => progress('ot', (i + 1) / o.otIterations),
    })
  }
  stage('ot')

  // 4. smooth LUT fit in output sRGB (unclamped); a single per-channel clamp at the end is continuous
  progress('fit', 0)
  const N = o.lutSize
  const nodes = lutNodeCount(N)
  const priorNodes = new Float64Array(nodes * 3)
  const lab = new Float64Array(3)
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 0; r < N; r++) {
        srgbToOklab(r / (N - 1), g / (N - 1), b / (N - 1), lab, 0)
        applyAffine(prior, lab, 0, lab, 0)
        oklabToSrgbUnclamped(lab, 0, priorNodes, lutIndex(N, r, g, b) * 3)
      }
  const targetsSrgb = new Float32Array(moved.length)
  for (let i = 0; i < moved.length; i += 3) oklabToSrgbUnclamped(moved, i, targetsSrgb, i)
  const fit = fitLut({
    inputs: tgt.srgb,
    targets: targetsSrgb,
    prior: priorNodes,
    size: N,
    sigma: o.smoothness,
    priorWeight: o.priorWeight,
    passes: o.fitPasses,
  })
  stage('fit')
  return { values: fit.nodes, support: fit.support }
}

/** ADR-005: content-robust look model evaluated directly at every node (smooth by construction). */
function lookNodes(
  refLabs: readonly Float32Array[],
  tgt: Samples,
  N: number,
  usedFallback: boolean,
  strength: number,
  progress: ProgressFn,
  stage: StageFn,
): NodeValues {
  progress('mkl', 0)
  const model = estimateLook(refLabs, tgt.oklab, { keepTone: usedFallback, strength })
  stage('mkl')
  stage('ot')
  progress('fit', 0)
  const nodes = lutNodeCount(N)
  const values = new Float64Array(nodes * 3)
  const lab = new Float64Array(3)
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 0; r < N; r++) {
        srgbToOklab(r / (N - 1), g / (N - 1), b / (N - 1), lab, 0)
        applyLook(model, lab, 0)
        oklabToSrgbUnclamped(lab, 0, values, lutIndex(N, r, g, b) * 3)
      }
  const support = new Float64Array(nodes)
  const d = N - 1
  for (let i = 0; i < tgt.srgb.length; i += 3) {
    const at = (c: number) => Math.round(tgt.srgb[i + c]! * d)
    const k = lutIndex(N, at(0), at(1), at(2))
    support[k] = support[k]! + 1
  }
  stage('fit')
  return { values, support }
}

const tmpLin = new Float64Array(3)
/** Oklab → sRGB without clamping (sign-preserving transfer), so the fit never sees clip kinks. */
function oklabToSrgbUnclamped(
  lab: ArrayLike<number>,
  i: number,
  out: Float32Array | Float64Array,
  o: number,
) {
  oklabToLinear(lab, i, tmpLin, 0)
  for (let c = 0; c < 3; c++) out[o + c] = linearToSrgb(tmpLin[c]!)
}

function poolSamples(list: readonly Samples[]): Samples {
  if (list.length === 1) return list[0]!
  const count = list.reduce((n, s) => n + s.count, 0)
  const srgb = new Float32Array(count * 3)
  const oklab = new Float32Array(count * 3)
  let o = 0
  for (const s of list) {
    srgb.set(s.srgb, o)
    oklab.set(s.oklab, o)
    o += s.count * 3
  }
  return { srgb, oklab, count }
}

function greyAxisMonotonic(data: Float32Array, N: number): boolean {
  const lab = new Float64Array(3)
  let prev = -Infinity
  for (let k = 0; k < N; k++) {
    const i = lutIndex(N, k, k, k) * 3
    srgbToOklab(data[i]!, data[i + 1]!, data[i + 2]!, lab, 0)
    if (lab[0]! < prev - 1e-3) return false
    prev = Math.max(prev, lab[0]!)
  }
  return true
}

function validateOptions(o: EngineOptions) {
  const bad =
    !Number.isInteger(o.lutSize) ||
    o.lutSize < 2 ||
    o.lutSize > 65 ||
    o.otRelaxation <= 0 ||
    o.otRelaxation > 1 ||
    o.otBins < 16 ||
    o.smoothness <= 0 ||
    o.fitPasses < 1 ||
    o.priorWeight <= 0 ||
    o.maxSamples < 64 ||
    !(o.lookStrength >= LOOK_STRENGTH_RANGE[0] && o.lookStrength <= LOOK_STRENGTH_RANGE[1])
  if (bad) throw new EngineError('INVALID_OPTIONS')
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
