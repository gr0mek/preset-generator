# ADR-002: Silnik transferu koloru — Oklab + MKL + sliced-OT + regularyzowany LUT

**Status:** Accepted — krok „fit siatki” superseded by ADR-004 · **Data:** 2026-10-01 · **Feature:** mvp · **Author:** 10x-Team (Architect + Staff Engineer)

## Context
Potrzebujemy mapy kolorów target→ref, która (a) oddaje zmiany zależne od barwy, (b) jest gładka (brak bandingu po zastosowaniu na pełnej rozdzielczości i innym materiale), (c) jest deterministyczna i testowalna, (d) liczy się ≤ 3 s w przeglądarce.

## Decision
Pipeline w `src/engine` (czysty TS, Worker): sRGB→linear→Oklab; MKL (mean+cov) jako globalny prior; sliced-OT (IDT, 12 iteracji, seeded RNG, relaksacja) na reszcie; dopasowanie siatki 33³ przez regularyzowane najmniejsze kwadraty (data term + Laplacian + prior MKL) metodą CG; soft-clip; walidacja. Fallback: Reinhard dla degeneratywnej referencji. Interfejs: `computeLut(ref, target, opts) → Lut3D`.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Reinhard / statystyki globalne | Bardzo prosty, szybki | Nie łapie zmian zależnych od barwy | Za słaba jakość jako główny tryb; zostaje jako fallback |
| Pełny OT (Sinkhorn) | Dokładniejszy | O(n²), za wolny w przeglądarce | Wydajność |
| Neural (ONNX, np. neural LUT) | Potencjalnie najlepsza jakość | Model, licencje, 10–50 MB, nieprzewidywalność | v2, jeśli OT nie przejdzie gate'u jakości |
| Bezpośredni splat OT do LUT bez regularyzacji | Prostsze | Dziury i szum w siatce → banding | Jakość |

## Consequences
**Positive:** gładkie, deterministyczne LUT-y; łatwe golden tests; brak zależności ML.
**Negative:** parametry (λ, iteracje) wymagają strojenia na zbiorze QA; transfer globalny (bez segmentacji, np. skóra vs niebo).
**Risks:** wydajność CG w TS → benchmark S3, opcja WASM/WebGPU; artefakty na ekstremalnych parach → soft-clip + ostrzeżenia.

## Dependencies
Konsumenci: `preview`, `export` (tylko przez `Lut3D`). Zmiana algorytmu nie może zmienić kontraktu `Lut3D` (ADR-003).
