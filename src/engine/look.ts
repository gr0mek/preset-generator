// Content-robust "look" model (ADR-005): instead of transporting the reference's colour
// distribution onto the target (which recolours content the reference doesn't contain),
// estimate the parameters of a grade — tone curve, neutral cast per tone, saturation and
// per-hue shifts — and only from statistics that both images actually share.
//
// With several references (frames of the same roll / grade), each parameter is estimated per
// reference and kept in proportion to how consistently the references agree on it: what every
// frame shares is the look, what varies between frames is content (ADR-006).

/** Neutral pixels reveal the colour cast; Oklab chroma tolerance grows with L (dark colours have little chroma). */
const NEUTRAL_C0 = 0.012
const NEUTRAL_CL = 0.02
/** Share of (fully) neutral pixels at which the cast estimate is trusted halfway. */
const NEUTRAL_EVIDENCE = 0.03
/** Pixels below this chroma carry no reliable hue. */
const CHROMA_MIN = 0.03
const TONE_TABLE = 256
const TINT_NODES = 17
const TINT_SIGMA = 0.08
const TINT_MAX = 0.05
const HUE_BINS = 36
const HUE_SMOOTH = 1.5
const HUE_SHIFT_MAX = (15 * Math.PI) / 180
/** A hue needs this share of chromatic weight in *both* images before it is adjusted. */
const HUE_SUPPORT = 0.01
const CONTRAST_RANGE: readonly [number, number] = [0.8, 1.25]
const SAT_RANGE: readonly [number, number] = [0.75, 1.3]
const HUE_SAT_RANGE: readonly [number, number] = [0.6, 1.4]
const UNSEEN_HUE_SAT = 0.5
/** Reference median chroma below this ⇒ treated as black & white. */
const MONO_C = 0.012
/**
 * Exposure is mostly content — move the target median only slightly. Even agreement between
 * references doesn't make it look: frames of one sunny roll agree on "bright" (leave-one-out
 * error on a darker frame of the same roll rose from 5% to 18% when agreement was trusted).
 */
const EXPOSURE_MATCH = 0.1
export const LOOK_STRENGTH_RANGE: readonly [number, number] = [0, 2]

export interface LookModel {
  /** Output L sampled at L = i/(TONE_TABLE-1). */
  tone: Float64Array
  /** Neutral (a,b) of target / reference per L node — removed, then re-applied. */
  tgtNeutral: Float64Array
  refNeutral: Float64Array
  /** Overall chroma trend across shared hues, log. */
  logSaturation: number
  /** Per hue bin: hue shift (rad) and log chroma factor, already confidence-weighted. */
  hueShift: Float64Array
  hueLogSat: Float64Array
  monochrome: boolean
  /** Scales every adjustment: 0 = identity, 1 = as estimated, 2 = exaggerated. */
  strength: number
}

export interface LookOptions {
  /** Skip tone matching (degenerate reference). */
  keepTone?: boolean
  strength?: number
}

interface RefEstimate {
  tone: ToneParams | null
  neutral: Float64Array
  monochrome: boolean
  /** per hue bin */
  conf: Float64Array
  shift: Float64Array
  logRatio: Float64Array
  support: Float64Array
}

interface ToneParams {
  logContrast: number
  exposure: number
  black: number
  white: number
}

export function estimateLook(
  refs: readonly Float32Array[],
  tgt: Float32Array,
  opts: LookOptions = {},
): LookModel {
  const tgtL = sorted(column(tgt, 0))
  const tgtNeutral = estimateNeutral(tgt)
  const tgtHue = hueStats(chromaAfterCast(tgt, tgtNeutral))
  const per = refs.map((r) => estimateRef(r, tgtL, tgtHue, opts.keepTone ?? false))

  // tone
  const tones = per.map((p) => p.tone).filter((t): t is ToneParams => t !== null)
  let tone = identityTone()
  if (tones.length > 0) {
    tone = buildTone(tgtL, {
      logContrast: agree(tones.map((t) => t.logContrast)),
      exposure: mean(tones.map((t) => t.exposure)) * EXPOSURE_MATCH,
      black: mean(tones.map((t) => t.black)),
      white: mean(tones.map((t) => t.white)),
    })
  }

  // cast
  const refNeutral = new Float64Array(TINT_NODES * 2)
  for (let i = 0; i < refNeutral.length; i++) refNeutral[i] = agree(per.map((p) => p.neutral[i]!))

  // hue & saturation
  const monochrome = per.filter((p) => p.monochrome).length * 2 > per.length
  const hueShift = new Float64Array(HUE_BINS)
  const hueLogSat = new Float64Array(HUE_BINS)
  let logSaturation = 0
  if (!monochrome) {
    const conf = new Float64Array(HUE_BINS)
    const logRatio = new Float64Array(HUE_BINS)
    let sw = 0
    let slog = 0
    for (let k = 0; k < HUE_BINS; k++) {
      const c = per.map((p) => p.conf[k]!)
      conf[k] = mean(c)
      if (conf[k]! <= 0) continue
      hueShift[k] =
        conf[k]! *
        agree(
          per.map((p) => p.shift[k]!),
          c,
        )
      logRatio[k] = agree(
        per.map((p) => p.logRatio[k]!),
        c,
      )
      const support = mean(per.map((p) => p.support[k]!))
      sw += support
      slog += support * logRatio[k]!
    }
    // Saturation is compared only between hues both images contain (like with like), so a
    // vivid forest isn't "desaturated" just because the reference is a pale beach.
    logSaturation = sw > 0 ? Math.log(clamp(Math.exp(slog / sw), ...SAT_RANGE)) : 0
    // Shared hues follow their own ratio; hues the reference lacks get only part (in log) of the
    // overall trend — enough to keep the grade coherent, not enough to wash them out.
    for (let k = 0; k < HUE_BINS; k++) {
      const own = clamp(logRatio[k]!, Math.log(HUE_SAT_RANGE[0]), Math.log(HUE_SAT_RANGE[1]))
      hueLogSat[k] = conf[k]! * own + (1 - conf[k]!) * UNSEEN_HUE_SAT * logSaturation
    }
    hueShift.set(smoothCircular(hueShift, HUE_SMOOTH))
    hueLogSat.set(smoothCircular(hueLogSat, HUE_SMOOTH))
  }

  return {
    tone,
    tgtNeutral,
    refNeutral,
    logSaturation,
    hueShift,
    hueLogSat,
    monochrome,
    strength: clamp(opts.strength ?? 1, ...LOOK_STRENGTH_RANGE),
  }
}

function estimateRef(
  ref: Float32Array,
  tgtL: Float32Array,
  tgtHue: HueStats,
  keepTone: boolean,
): RefEstimate {
  const neutral = estimateNeutral(ref)
  const chroma = chromaAfterCast(ref, neutral)
  const monochrome = quantile(sorted(chroma.c), 0.5) < MONO_C
  const conf = new Float64Array(HUE_BINS)
  const shift = new Float64Array(HUE_BINS)
  const logRatio = new Float64Array(HUE_BINS)
  const support = new Float64Array(HUE_BINS)
  if (!monochrome) {
    const r = hueStats(chroma)
    const t = tgtHue
    for (let k = 0; k < HUE_BINS; k++) {
      if (r.weight[k]! <= 0 || t.weight[k]! <= 0 || t.meanC[k]! <= 0 || r.meanC[k]! <= 0) continue
      support[k] = Math.min(r.share[k]!, t.share[k]!)
      conf[k] = support[k]! / (support[k]! + HUE_SUPPORT)
      shift[k] = clamp(wrapAngle(r.hue[k]! - t.hue[k]!), -HUE_SHIFT_MAX, HUE_SHIFT_MAX)
      logRatio[k] = Math.log(r.meanC[k]! / t.meanC[k]!)
    }
  }
  return {
    tone: keepTone ? null : toneParams(sorted(column(ref, 0)), tgtL),
    neutral,
    monochrome,
    conf,
    shift,
    logRatio,
    support,
  }
}

/** Apply the look to one Oklab colour, in place. */
export function applyLook(m: LookModel, lab: Float64Array | Float32Array, i: number): void {
  const s = m.strength
  const L = lab[i]!
  const Lout = L + s * (table(m.tone, L) - L)
  let a = lab[i + 1]! - s * nodeAt(m.tgtNeutral, L, 0)
  let b = lab[i + 2]! - s * nodeAt(m.tgtNeutral, L, 1)
  const C = Math.hypot(a, b)
  if (C > 0) {
    const h = Math.atan2(b, a)
    // hue-specific edits fade out towards neutral, where hue is undefined
    const w = smoothstep(0.01, 0.05, C)
    const k = hueIndex(h)
    const C2 = m.monochrome
      ? C * Math.max(0, 1 - s)
      : C * Math.exp(s * (w * circularTable(m.hueLogSat, k) + (1 - w) * UNSEEN_HUE_SAT * m.logSaturation))
    const h2 = h + s * w * circularTable(m.hueShift, k)
    a = C2 * Math.cos(h2)
    b = C2 * Math.sin(h2)
  }
  lab[i] = Lout
  lab[i + 1] = a + s * nodeAt(m.refNeutral, Lout, 0)
  lab[i + 2] = b + s * nodeAt(m.refNeutral, Lout, 1)
}

// --- agreement between references ---------------------------------------------------------

/** Weighted mean, shrunk towards 0 by how much the references disagree (single value: unchanged). */
function agree(values: readonly number[], weights?: readonly number[]): number {
  const m = mean(values, weights)
  if (values.length < 2) return m
  return m * consistency(values, weights)
}

/** m² / (m² + variance) ∈ [0,1]: 1 when all values agree, → 0 when they scatter around 0. */
function consistency(values: readonly number[], weights?: readonly number[]): number {
  if (values.length < 2) return 1
  const m = mean(values, weights)
  let v = 0
  let ws = 0
  values.forEach((x, i) => {
    const w = weights ? weights[i]! : 1
    v += w * (x - m) ** 2
    ws += w
  })
  v = ws > 0 ? v / ws : 0
  return m * m + v > 1e-12 ? (m * m) / (m * m + v) : 1
}

function mean(values: readonly number[], weights?: readonly number[]): number {
  let s = 0
  let ws = 0
  values.forEach((x, i) => {
    const w = weights ? weights[i]! : 1
    s += w * x
    ws += w
  })
  return ws > 0 ? s / ws : 0
}

// --- tone ---------------------------------------------------------------------------------

const TONE_Q = [0.01, 0.25, 0.5, 0.75, 0.99] as const
type Quantiles = [number, number, number, number, number]
const quantiles = (s: Float32Array) => TONE_Q.map((p) => quantile(s, p)) as Quantiles

function toneParams(refL: Float32Array, tgtL: Float32Array): ToneParams | null {
  const [t01, t25, t50, t75, t99] = quantiles(tgtL)
  const [r01, r25, r50, r75, r99] = quantiles(refL)
  if (t99 - t01 < 0.05 || r99 - r01 < 0.05 || t75 - t25 < 1e-3) return null
  return {
    logContrast: Math.log(clamp((r75 - r25) / (t75 - t25), ...CONTRAST_RANGE)),
    exposure: r50 - t50,
    black: r01,
    white: r99,
  }
}

function buildTone(tgtL: Float32Array, p: ToneParams): Float64Array {
  const [t01, t25, t50, t75, t99] = quantiles(tgtL)
  if (t99 - t01 < 0.05 || t75 - t25 < 1e-3) return identityTone()
  const k = Math.exp(p.logContrast)
  const mid = t50 + p.exposure
  const y25 = mid - (t50 - t25) * k
  const y75 = mid + (t75 - t50) * k
  // black/white points are the look (fade, highlight roll-off) — but must stay ordered
  const y01 = Math.min(p.black, y25 - 0.01)
  const y99 = Math.max(p.white, y75 + 0.01)
  const sLo = (y25 - y01) / (t25 - t01)
  const sHi = (y99 - y75) / (t99 - t75)
  const y0 = clamp(y01 - t01 * sLo, 0, Math.max(0, y01))
  const y1 = clamp(y99 + (1 - t99) * sHi, Math.min(1, y99), 1)

  const xs = [0, t01, t25, t50, t75, t99, 1]
  const ys = [y0, y01, y25, mid, y75, y99, y1]
  const out = new Float64Array(TONE_TABLE)
  pchip(xs, ys, out)
  return out
}

function identityTone(): Float64Array {
  const out = new Float64Array(TONE_TABLE)
  for (let i = 0; i < TONE_TABLE; i++) out[i] = i / (TONE_TABLE - 1)
  return out
}

/** Monotone cubic (Fritsch–Carlson) through (xs, ys), tabulated on [0,1]. */
function pchip(xs: number[], ys: number[], out: Float64Array): void {
  const n = xs.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / Math.max(1e-9, xs[i + 1]! - xs[i]!))
  const m = new Array<number>(n)
  m[0] = d[0]!
  m[n - 1] = d[n - 2]!
  for (let i = 1; i < n - 1; i++)
    m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (2 * d[i - 1]! * d[i]!) / (d[i - 1]! + d[i]!)
  let seg = 0
  for (let j = 0; j < out.length; j++) {
    const x = j / (out.length - 1)
    while (seg < n - 2 && x > xs[seg + 1]!) seg++
    const h = Math.max(1e-9, xs[seg + 1]! - xs[seg]!)
    const t = clamp((x - xs[seg]!) / h, 0, 1)
    const t2 = t * t
    const t3 = t2 * t
    out[j] =
      (2 * t3 - 3 * t2 + 1) * ys[seg]! +
      (t3 - 2 * t2 + t) * h * m[seg]! +
      (-2 * t3 + 3 * t2) * ys[seg + 1]! +
      (t3 - t2) * h * m[seg + 1]!
  }
}

// --- neutral cast -------------------------------------------------------------------------

/** Mean (a,b) of near-neutral pixels as a smooth function of L; sparse tones shrink to the global cast. */
function estimateNeutral(lab: Float32Array): Float64Array {
  const W = new Float64Array(TINT_NODES)
  const A = new Float64Array(TINT_NODES)
  const B = new Float64Array(TINT_NODES)
  let gW = 0
  let gA = 0
  let gB = 0
  for (let i = 0; i < lab.length; i += 3) {
    const L = lab[i]!
    const a = lab[i + 1]!
    const b = lab[i + 2]!
    const tol = NEUTRAL_C0 + NEUTRAL_CL * L
    const w = Math.exp(-((a * a + b * b) / (tol * tol)))
    gW += w
    gA += w * a
    gB += w * b
    for (let k = 0; k < TINT_NODES; k++) {
      const g = w * Math.exp(-0.5 * ((L - k / (TINT_NODES - 1)) / TINT_SIGMA) ** 2)
      W[k] = W[k]! + g
      A[k] = A[k]! + g * a
      B[k] = B[k]! + g * b
    }
  }
  const out = new Float64Array(TINT_NODES * 2)
  if (gW <= 0) return out
  // Shrink towards the global cast, and the global cast towards "no cast": an image without real
  // neutrals must not have its least-colourful content (sand, foliage in shade) read as a cast.
  const n = lab.length / 3
  const confidence = gW / (gW + NEUTRAL_EVIDENCE * n)
  const ga = (gA / gW) * confidence
  const gb = (gB / gW) * confidence
  const prior = 0.002 * n
  for (let k = 0; k < TINT_NODES; k++) {
    const local = W[k]! / (W[k]! + NEUTRAL_EVIDENCE * n * 0.25)
    let a = ((A[k]! + prior * ga) / (W[k]! + prior)) * Math.max(local, confidence)
    let b = ((B[k]! + prior * gb) / (W[k]! + prior)) * Math.max(local, confidence)
    const mag = Math.hypot(a, b)
    if (mag > TINT_MAX) {
      a *= TINT_MAX / mag
      b *= TINT_MAX / mag
    }
    out[k * 2] = a
    out[k * 2 + 1] = b
  }
  return out
}

function nodeAt(nodes: Float64Array, L: number, c: 0 | 1): number {
  const f = clamp(L, 0, 1) * (TINT_NODES - 1)
  const k = Math.min(Math.floor(f), TINT_NODES - 2)
  const t = f - k
  return nodes[k * 2 + c]! * (1 - t) + nodes[(k + 1) * 2 + c]! * t
}

// --- chroma & hue -------------------------------------------------------------------------

interface ChromaSamples {
  c: Float32Array
  h: Float32Array
}

function chromaAfterCast(lab: Float32Array, neutral: Float64Array): ChromaSamples {
  const n = lab.length / 3
  const c = new Float32Array(n)
  const h = new Float32Array(n)
  for (let j = 0; j < n; j++) {
    const L = lab[j * 3]!
    const a = lab[j * 3 + 1]! - nodeAt(neutral, L, 0)
    const b = lab[j * 3 + 2]! - nodeAt(neutral, L, 1)
    c[j] = Math.hypot(a, b)
    h[j] = Math.atan2(b, a)
  }
  return { c, h }
}

interface HueStats {
  weight: Float64Array
  share: Float64Array
  hue: Float64Array
  meanC: Float64Array
}

function hueStats(s: ChromaSamples): HueStats {
  const W = new Float64Array(HUE_BINS)
  const X = new Float64Array(HUE_BINS)
  const Y = new Float64Array(HUE_BINS)
  const CS = new Float64Array(HUE_BINS)
  const N = new Float64Array(HUE_BINS)
  for (let j = 0; j < s.c.length; j++) {
    const C = s.c[j]!
    if (C < CHROMA_MIN) continue
    const k = Math.round(hueIndex(s.h[j]!)) % HUE_BINS
    W[k] = W[k]! + C
    X[k] = X[k]! + C * Math.cos(s.h[j]!)
    Y[k] = Y[k]! + C * Math.sin(s.h[j]!)
    CS[k] = CS[k]! + C
    N[k] = N[k]! + 1
  }
  const w = smoothCircular(W, HUE_SMOOTH)
  const x = smoothCircular(X, HUE_SMOOTH)
  const y = smoothCircular(Y, HUE_SMOOTH)
  const cs = smoothCircular(CS, HUE_SMOOTH)
  const nn = smoothCircular(N, HUE_SMOOTH)
  const total = w.reduce((a, v) => a + v, 0)
  const share = new Float64Array(HUE_BINS)
  const hue = new Float64Array(HUE_BINS)
  const meanC = new Float64Array(HUE_BINS)
  for (let k = 0; k < HUE_BINS; k++) {
    share[k] = total > 0 ? w[k]! / total : 0
    hue[k] = Math.atan2(y[k]!, x[k]!)
    meanC[k] = nn[k]! > 0 ? cs[k]! / nn[k]! : 0
  }
  return { weight: w, share, hue, meanC }
}

/** Continuous bin coordinate in [0, HUE_BINS). */
function hueIndex(h: number): number {
  const u = (h / (2 * Math.PI)) * HUE_BINS
  return ((u % HUE_BINS) + HUE_BINS) % HUE_BINS
}

function circularTable(t: Float64Array, k: number): number {
  const k0 = Math.floor(k) % HUE_BINS
  const k1 = (k0 + 1) % HUE_BINS
  const f = k - Math.floor(k)
  return t[k0]! * (1 - f) + t[k1]! * f
}

function smoothCircular(v: Float64Array, sigma: number): Float64Array {
  const n = v.length
  const r = Math.ceil(sigma * 3)
  const out = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let s = 0
    let ws = 0
    for (let d = -r; d <= r; d++) {
      const w = Math.exp(-0.5 * (d / sigma) ** 2)
      s += w * v[(((k + d) % n) + n) % n]!
      ws += w
    }
    out[k] = s / ws
  }
  return out
}

// --- helpers ------------------------------------------------------------------------------

function column(lab: Float32Array, c: number): Float32Array {
  const out = new Float32Array(lab.length / 3)
  for (let j = 0; j < out.length; j++) out[j] = lab[j * 3 + c]!
  return out
}

function sorted(v: Float32Array): Float32Array {
  return Float32Array.from(v).sort()
}

function quantile(s: Float32Array, p: number): number {
  if (s.length === 0) return 0
  const f = p * (s.length - 1)
  const i = Math.floor(f)
  const j = Math.min(i + 1, s.length - 1)
  return s[i]! + (s[j]! - s[i]!) * (f - i)
}

function table(t: Float64Array, x: number): number {
  if (x <= 0) return t[0]! + x // identity slope outside the table keeps continuity
  if (x >= 1) return t[t.length - 1]! + (x - 1)
  const f = x * (t.length - 1)
  const i = Math.min(Math.floor(f), t.length - 2)
  return t[i]! + (t[i + 1]! - t[i]!) * (f - i)
}

function wrapAngle(x: number): number {
  return Math.atan2(Math.sin(x), Math.cos(x))
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
