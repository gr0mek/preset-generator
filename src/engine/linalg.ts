// Minimal 3×3 linear algebra. Matrices are row-major Float64Array(9).
export type Mat3 = Float64Array
export type Vec3 = Float64Array

export const mat3 = (values?: ArrayLike<number>): Mat3 => {
  const m = new Float64Array(9)
  if (values) m.set(values)
  return m
}
export const identity3 = (): Mat3 => mat3([1, 0, 0, 0, 1, 0, 0, 0, 1])

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = new Float64Array(9)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!
  return r
}

export function transpose3(a: Mat3): Mat3 {
  return mat3([a[0]!, a[3]!, a[6]!, a[1]!, a[4]!, a[7]!, a[2]!, a[5]!, a[8]!])
}

/** Mean and covariance of an interleaved n×3 point cloud. */
export function meanCov(points: Float32Array | Float64Array): { mean: Vec3; cov: Mat3 } {
  const n = points.length / 3
  const mean = new Float64Array(3)
  for (let i = 0; i < points.length; i += 3) {
    mean[0]! += points[i]!
    mean[1]! += points[i + 1]!
    mean[2]! += points[i + 2]!
  }
  mean[0]! /= n
  mean[1]! /= n
  mean[2]! /= n
  const c = new Float64Array(9)
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i]! - mean[0]!
    const y = points[i + 1]! - mean[1]!
    const z = points[i + 2]! - mean[2]!
    c[0]! += x * x
    c[1]! += x * y
    c[2]! += x * z
    c[4]! += y * y
    c[5]! += y * z
    c[8]! += z * z
  }
  for (const k of [0, 1, 2, 4, 5, 8]) c[k]! /= n
  c[3] = c[1]!
  c[6] = c[2]!
  c[7] = c[5]!
  return { mean, cov: c }
}

/** Eigendecomposition of a symmetric 3×3 matrix (cyclic Jacobi). A = V diag(values) Vᵀ, V columns are eigenvectors. */
export function eigenSym3(a: Mat3): { values: Vec3; vectors: Mat3 } {
  const m = mat3(a)
  const v = identity3()
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = m[1]! ** 2 + m[2]! ** 2 + m[5]! ** 2
    if (off < 1e-30) break
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      const apq = m[p * 3 + q]!
      if (Math.abs(apq) < 1e-300) continue
      const app = m[p * 3 + p]!
      const aqq = m[q * 3 + q]!
      const theta = (aqq - app) / (2 * apq)
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const c = 1 / Math.sqrt(t * t + 1)
      const s = t * c
      // rotate rows/cols p,q of m
      for (let k = 0; k < 3; k++) {
        const mkp = m[k * 3 + p]!
        const mkq = m[k * 3 + q]!
        m[k * 3 + p] = c * mkp - s * mkq
        m[k * 3 + q] = s * mkp + c * mkq
      }
      for (let k = 0; k < 3; k++) {
        const mpk = m[p * 3 + k]!
        const mqk = m[q * 3 + k]!
        m[p * 3 + k] = c * mpk - s * mqk
        m[q * 3 + k] = s * mpk + c * mqk
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k * 3 + p]!
        const vkq = v[k * 3 + q]!
        v[k * 3 + p] = c * vkp - s * vkq
        v[k * 3 + q] = s * vkp + c * vkq
      }
    }
  }
  return { values: new Float64Array([m[0]!, m[4]!, m[8]!]), vectors: v }
}

/** f(A) for symmetric A via eigendecomposition: V diag(f(λ)) Vᵀ. */
export function symFn3(a: Mat3, f: (lambda: number) => number): Mat3 {
  const { values, vectors: v } = eigenSym3(a)
  const r = new Float64Array(9)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += v[i * 3 + k]! * f(values[k]!) * v[j * 3 + k]!
      r[i * 3 + j] = s
    }
  return r
}

export const sqrtm3 = (a: Mat3, eps = 0) => symFn3(a, (l) => Math.sqrt(Math.max(l, 0) + eps))
export const invSqrtm3 = (a: Mat3, eps = 1e-8) => symFn3(a, (l) => 1 / Math.sqrt(Math.max(l, 0) + eps))
