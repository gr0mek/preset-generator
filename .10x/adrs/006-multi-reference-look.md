# ADR-006: Kilka referencji jednego looku + suwak siły looku

**Status:** Accepted · **Data:** 2026-10-02 · **Feature:** mvp · **Author:** 10x-Team (SDE)
**Rozszerza:** ADR-005. Kontrakt `Lut3D` (ADR-003) bez zmian.

## Context
Pomiary na 5 skanach jednej rolki: zafarb neutralnych pikseli różni się między klatkami (a od −14 do +22 ×10⁻³),
czyli „ciepło” z pojedynczej referencji to w dużej mierze treść kadru. Model z ADR-005 był przez to
bezpieczny, ale za słaby — użytkownik chce mocniejszego efektu.

## Decision
1. `computeLut({ reference: PixelSource | PixelSource[] })`. Każdy parametr looku (kontrast, czerń/biel,
   zafarb per ton, przesunięcie i nasycenie per barwa) liczony osobno dla każdej referencji, a potem łączony:
   `średnia × m²/(m²+wariancja)` — cechy wspólne wszystkim klatkom zostają, rozbieżne (treść) są tłumione.
   Budżet próbek dzielony między referencje (koszt ≈ jak jedna; ~0,5 s dla 5).
2. `EngineOptions.lookStrength` ∈ [0, 2] (domyślnie 1) — skaluje każdą korektę modelu (0 = identity,
   2 = przesadzony). W odróżnieniu od `applyStrength` przy eksporcie (lerp z identity) wzmacnia *parametry*,
   więc >1 nie wychodzi poza strukturę looku.
3. Ekspozycja: dopasowanie 10% (było 25%), bez nagradzania zgodności między referencjami; kontrast 0,8–1,25.

## Evidence (leave-one-out: klatka rolki jako target, pozostałe 4 jako referencje; idealnie ≈ 0)
| Wariant | Średni błąd |
|---|---|
| Zgodność ekspozycji nagradzana (0,25 + 0,45·zgodność) | 6,79% (ciemna klatka 18,3%) |
| Ekspozycja 0,25, bez nagrody | 3,97% |
| **Wybrane: ekspozycja 0,1, kontrast 0,8–1,25** | **2,97%** |
Uwaga: ta metryka mierzy tylko „nie szkodzić” (identity = 0%) — dlatego nie optymalizowano jej do końca;
siła efektu jest regulowana suwakiem.

## Consequences
**Positive:** więcej klatek z rolki = trafniejszy look; użytkownik dostaje kontrolę nad intensywnością.
**Negative:** UI musi przyjąć wiele plików referencji (zmiana E2.4/E8.2); przy 1 referencji bez zmian względem ADR-005.
**Risks:** jasność całej rolki (np. prześwietlona klisza) nie zostanie przeniesiona automatycznie — tylko suwakiem.
