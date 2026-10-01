import { eigenSym3, mat3, mul3, sqrtm3, invSqrtm3, transpose3 } from './linalg'

const A = mat3([4, 1, 0.5, 1, 3, 0.2, 0.5, 0.2, 2])

describe('linalg', () => {
  it('eigendecomposition reconstructs A', () => {
    const { values, vectors: V } = eigenSym3(A)
    const D = mat3([values[0]!, 0, 0, 0, values[1]!, 0, 0, 0, values[2]!])
    const R = mul3(mul3(V, D), transpose3(V))
    for (let i = 0; i < 9; i++) expect(R[i]).toBeCloseTo(A[i]!, 10)
  })

  it('sqrtm squared equals A; invSqrtm is its inverse', () => {
    const S = sqrtm3(A)
    const SS = mul3(S, S)
    for (let i = 0; i < 9; i++) expect(SS[i]).toBeCloseTo(A[i]!, 10)
    const I = mul3(S, invSqrtm3(A, 0))
    for (let i = 0; i < 9; i++) expect(I[i]).toBeCloseTo(i % 4 === 0 ? 1 : 0, 8)
  })
})
