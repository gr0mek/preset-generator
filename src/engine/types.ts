/** Pixel buffer compatible with ImageData, without depending on the DOM. RGBA, 8-bit, row-major. */
export interface PixelSource {
  readonly data: Uint8ClampedArray | Uint8Array
  readonly width: number
  readonly height: number
}

/**
 * Canonical preset representation (ADR-003).
 * sRGB in → sRGB out, values in [0,1], RGB triplets, R index changes fastest.
 */
export interface Lut3D {
  readonly size: number
  readonly data: Float32Array
  readonly meta: LutMeta
}

export interface LutMeta {
  title: string
  sourceRef?: string
  createdAt: string
}

export interface EngineOptions {
  /**
   * 'look' — estimate a content-robust grade (tone, cast, saturation, per-hue shifts; ADR-005).
   * 'transfer' — move the target's colour distribution onto the reference's (MKL + sliced-OT; ADR-002).
   */
  mode: 'look' | 'transfer'
  /** LUT grid points per axis. */
  lutSize: number
  /** Sliced-OT iterations (random rotations). */
  otIterations: number
  /** Step size of each OT iteration, (0,1]. */
  otRelaxation: number
  /** Histogram bins for 1D transport. */
  otBins: number
  /** Gaussian width (in grid nodes) of the LUT fit — larger = smoother. */
  smoothness: number
  /** Pull towards the MKL prior where data is sparse (relative to mean sample density). */
  priorWeight: number
  /** Residual-correction passes of the LUT fit. */
  fitPasses: number
  /** Max samples taken from each image. */
  maxSamples: number
  /** RNG seed — same inputs + seed ⇒ identical LUT. */
  seed: number
}

export type EngineStage = 'samples' | 'mkl' | 'ot' | 'fit' | 'finalize'
export type ProgressFn = (stage: EngineStage, fraction: number) => void

export type EngineWarningCode =
  | 'LOW_VARIANCE_REFERENCE' // reference nearly uniform → statistical fallback used
  | 'LOW_VARIANCE_TARGET' // target nearly uniform → LUT poorly constrained
  | 'TONE_INVERSION' // luminance along the grey axis is not monotonic
  | 'GAMUT_CLIPPED' // a noticeable share of LUT nodes were soft-clipped

export interface EngineWarning {
  code: EngineWarningCode
  detail?: string
}

export interface EngineStats {
  refSamples: number
  targetSamples: number
  timingsMs: Record<EngineStage, number>
  usedFallback: boolean
}

export interface EngineResult {
  lut: Lut3D
  warnings: EngineWarning[]
  stats: EngineStats
}

export type EngineErrorCode = 'EMPTY_IMAGE' | 'INVALID_OPTIONS' | 'NUMERIC_FAILURE' | 'ABORTED'

export class EngineError extends Error {
  readonly code: EngineErrorCode
  constructor(code: EngineErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'EngineError'
    this.code = code
  }
}

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  mode: 'look',
  lutSize: 33,
  otIterations: 12,
  otRelaxation: 0.8,
  otBins: 512,
  smoothness: 1.0,
  priorWeight: 0.05,
  fitPasses: 3,
  maxSamples: 131072,
  seed: 0x5eed,
}
