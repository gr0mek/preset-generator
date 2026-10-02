# SDE — mvp

## Zbudowane (2026-10-01)
| Obszar | Pliki | Zadania |
|---|---|---|
| Setup | `package.json`, `tsconfig.app.json` (strict + noUncheckedIndexedAccess), `eslint.config.js` (granice modułów), `.prettierrc`, `vite.config.ts` (Vitest), `playwright.config.ts`, `.github/workflows/ci.yml`, `public/_headers` (CSP) | E0.1–E0.6 |
| Silnik | `src/engine/{types,rng,color,linalg,samples,mkl,ot,fit,lut,pipeline,index}.ts` | E4.1–E4.10 |
| Worker | `src/engine/engine.worker.ts`, `src/engine/client.ts` (Comlink, świeży worker per wywołanie, AbortSignal, timeout 15 s) | E4.11 |
| Eksport | `src/export/{cube,filename,index}.ts` | E7a.1, E7a.2 (częściowo) |
| Dev | `dev/bench.html` + `src/dev/bench.ts` + `dev/run-bench.mjs` (benchmark w Chromium), `dev/make-lut.ts` (`npm run lut`), `dev/demo-pair.ts` | E1.4, E1.5, E4.12 (harness) |
| Testy | 29 unit (Vitest) + 1 e2e smoke (Playwright); `test/synth.ts` (obrazy syntetyczne + znany „film look”), `test/lutMetrics.ts` | — |

## Wyniki
- Odtworzenie znanego nieliniowego looku: średni błąd **0.3%** (vs ~6–10% bez LUT), deterministyczne przy stałym seed.
- Czas w Chromium (Web Worker, 2 vCPU, 512 px): **~1.0 s** mediana (samples 32 ms, MKL 26, OT 282, fit 604, finalize 5). Budżet 3 s spełniony → **TS wystarcza, WASM niepotrzebny** (decyzja S3).
- Referencja B&W → poprawna desaturacja przez MKL (bez fallbacku). Fallback Reinhard tylko dla referencji niemal jednolitej (std L < 0.02).

## Odchylenia od planu
1. **Fit siatki: normalized convolution zamiast CG** → ADR-004 (CG nie zbiegał, nieciągłości przy gamut mappingu w Oklab).
2. **Fit w sRGB wyjściowym** (bez pośredniego obcinania), nie w Oklab — ciągłość na krawędzi gamutu.
3. **React 19 / TS 6 / Vite 8** (aktualny szablon) zamiast React 18 ze specu — bez wpływu na architekturę.
4. **Brak husky/lint-staged** — CI pilnuje jakości; dodać przy pracy zespołowej.
5. Granice modułów przez `no-restricted-imports` zamiast `eslint-plugin-boundaries` (prościej, ten sam efekt).
6. `EngineOptions`: `smoothness` = σ Gaussa w węzłach, dodane `fitPasses`; usunięte `fitIterations` ze statystyk.

## Zmiana silnika (2026-10-02) → ADR-005
Prawdziwe pary (skany klisz + zdjęcia z telefonu) ujawniły, że transfer rozkładów przemalowuje treść
(zieleń → pomarańcz). Nowy domyślny `mode: 'look'` (`src/engine/look.ts`): krzywa tonalna, zafarb
neutralny per ton, nasycenie/przesunięcia per barwa tylko dla barw wspólnych. ~0,3 s. Stary tryb:
`mode: 'transfer'`. Harness: `npm run lut -- --options='{"mode":"transfer"}' ...`.

## Dług techniczny
- `GAMUT_CLIPPED` może być nadwrażliwy (wystąpił na syntetycznej parze) — skalibrować na zbiorze QA.
- Załamanie ~0.05 na krawędzi rozkładu kolorów targetu (ADR-004 „Negative”) — obserwować na realnych LUT-ach.
- `dev/make-lut.ts` dekoduje JPEG bez EXIF orientation (harness dev, nie produkcja).
- Benchmark nie mierzy słabszego sprzętu (throttling CDP nie działa na workery) — E10.5.

## Do zrobienia dalej (kolejność)
E1.6 zbiór QA → E4.12 strojenie + M1 gate → E7a.2 golden tests → E3 IO → E1.1–E1.3 spike'i formatów (wymagają Lightroom/Resolve).
