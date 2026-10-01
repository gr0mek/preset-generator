# Senior Engineer — mvp

## Podejście implementacyjne (kluczowe miejsca)
- **Silnik — kolejność:** typy → konwersje → statystyki → MKL → OT → fit → post. Każdy krok jako czysta funkcja z testem na danych syntetycznych, zanim zostanie złożony w pipeline.
- **Eigendecomposition 3×3:** metoda Jacobiego (stabilna, mała). `sqrtm` przez eigendekompozycję symetrycznej macierzy. Regularyzacja kowariancji `+ εI` (ε=1e-6).
- **Sliced-OT:** rotacje z ortonormalizacji Gram-Schmidta losowej macierzy (seeded); histogram matching przez sortowanie projekcji (n≈262k próbek → sort typed array, OK w ~50 ms) lub kwantyle na 1024 binach jeśli S3 pokaże problem.
- **Fit siatki:** macierz rzadka nie jest jawnie budowana — operator `A^T A + λL` aplikowany matrix-free w CG; 3 kanały niezależnie; warm start = prior MKL.
- **Podgląd:** `texImage3D` z `RGB16F` (szerzej wspierane niż RGB32F z LINEAR); współrzędne `(c * (N-1) + 0.5) / N`.
- **Zgodność podgląd/eksport:** CPU `applyLut` (trilinear) jako referencja w testach i w fallbacku Canvas 2D — jedna implementacja.
- **.cube:** R-fastest; `.3dl` i `.xmp` — wg wyników spike'ów (zapisać tutaj).

## Trudne miejsca
1. Kodowanie `.xmp` (S1) — notatki z E1.1 dopisać tutaj.
2. Kolejność osi `.3dl` (S2).
3. Dobór λ — za małe: banding; za duże: wypłukany look. Strojenie w E4.12 na zbiorze QA.
4. Safari: WebGL2 + float textures, `createImageBitmap` z orientacją — E2E na WebKit od początku.

## Wyniki spike'ów
_(uzupełnić po E1.1–E1.5)_
