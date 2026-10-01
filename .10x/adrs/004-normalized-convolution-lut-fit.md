# ADR-004: Dopasowanie siatki LUT przez normalized convolution (zamiast CG)

**Status:** Accepted · **Data:** 2026-10-01 · **Feature:** mvp · **Author:** 10x-Team (Architect + SDE)
**Supersedes:** krok 4 (fit siatki) z ADR-002. Reszta ADR-002 obowiązuje.

## Context
Implementacja ADR-002 (regularyzowane LSQ, CG matrix-free) w praktyce:
- Laplacian (membrana) tworzył „ostrza” w punktach danych; wersja z karą krzywizny (D₂) była źle uwarunkowana — CG nie zbiegał w 300 iteracjach (także z warm startem coarse-to-fine), fit 2–3 s.
- Dopasowanie w Oklab + gamut mapping (redukcja chromy) dawało **nieciągłości** (skoki do 0.57) na krawędzi gamutu — groźne, bo LUT trafia na inny materiał niż target.

## Decision
1. Fit w **wyjściowym sRGB, bez obcinania** wartości pośrednich (prior MKL i cele OT konwertowane Oklab→sRGB ze znakiem); jedno obcięcie per kanał na końcu (ciągłe — co najwyżej załamanie, nigdy skok).
2. **Normalized convolution** (Knutsson & Westin): `r = K*(Σ w·(y−LUT)) / (K*(Σ w) + ε)`, K = suma Gaussów σ, 4σ, 16σ (wagi 1, 0.05, 0.0025) — detal tam, gdzie są dane; gładka ekstrapolacja reszty tam, gdzie ich brak; ε (priorWeight) ściąga do priora MKL przy braku danych.
3. 3 przebiegi korekcji reszty (odzyskują detal tracony przez rozmycie).
Domyślne: σ=1.0 węzła, priorWeight=0.05, passes=3.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| CG + Laplacian (ADR-002) | Klasyczne LSQ | Ostrza w punktach danych | Jakość |
| CG + krzywizna D₂, multilevel | Najgładsze teoretycznie | Brak zbieżności w budżecie, 2–3 s | Wydajność / niepełna zbieżność = artefakty |
| Fit w Oklab + gamut mapping chromy | Zachowuje odcień | Nieciągłości na krawędzi gamutu | Ryzyko bandingu na innym materiale |

## Consequences
**Positive:** fit ~100–600 ms, całość ~1 s w Chromium (2 vCPU) dla 512 px; gładki z konstrukcji; deterministyczny; prosty kod (brak solvera).
**Negative:** na krawędzi rozkładu kolorów targetu pozostaje załamanie ~0.05 (vs ~0.001 w ground truth) — ograniczenie samego transferu rozkładów (OT) na brzegach.
**Risks:** dobór σ na realnych zdjęciach (mało próbek → szum) — strojenie w E4.12 na zbiorze QA.

## Dependencies
Kontrakt `Lut3D` (ADR-003) bez zmian.
