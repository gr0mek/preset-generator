# ADR-005: Silnik „look” odporny na treść (zamiast transferu rozkładów jako trybu domyślnego)

**Status:** Accepted · **Data:** 2026-10-02 · **Feature:** mvp · **Author:** 10x-Team (SDE)
**Supersedes:** ADR-002 jako tryb domyślny. Transfer (MKL + sliced-OT, ADR-002/004) zostaje jako `mode: 'transfer'`.

## Context
Pierwsze prawdziwe pary (skany klisz Gromka jako referencje, zdjęcie z telefonu jako target) pokazały,
że transfer rozkładów przenosi *treść* referencji zamiast jej *looku*: referencja bez zieleni
(plaża, morze) zamieniała zielony las w pomarańcz/beż, a żółta ściana stawała się sina.
Strojenie (sam MKL, słabszy OT, mocniejsze wygładzanie) nie pomagało — to cecha metody.

## Decision
`src/engine/look.ts` estymuje parametry gradacji i stosuje je bezpośrednio w każdym węźle LUT (Oklab):
1. **Ton:** monotoniczna krzywa (PCHIP) z punktów czerni/bieli referencji (fade, roll-off), kontrastu
   (stosunek IQR, ograniczony 0.7–1.4) i tylko 25% przesunięcia ekspozycji (ekspozycja to głównie treść).
2. **Zafarb neutralny per ton:** średnie (a,b) pikseli prawie neutralnych (tolerancja rośnie z L) — zafarb
   targetu usuwany, zafarb referencji nakładany. Przy braku neutralnych estymata ściągana do „brak zafarbu”.
3. **Nasycenie i przesunięcia barw per zakres barw (36 binów):** liczone tylko dla barw obecnych
   w *obu* obrazach (pewność = wspólny udział). Barwy nieobecne w referencji: brak przesunięcia barwy,
   tylko połowa (log) ogólnego trendu nasycenia. Przesunięcie ≤ 15°.
4. Monochromatyczna referencja → pełna desaturacja.
Wynik nadal `Lut3D` (ADR-003) — podgląd i eksport bez zmian.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Transfer MKL + sliced-OT (ADR-002) | Dokładny przy podobnej treści | Kradnie kolory treści | Główny tryb zawodzi na realnych parach |
| Strojenie OT (relaksacja, σ) | Bez nowego kodu | Nie usuwa przyczyny | Sprawdzone — brak poprawy |
| Segmentacja semantyczna (niebo/skóra/roślinność) | Najlepsze dopasowanie per obiekt | Model ML, rozmiar, czas | v2, jeśli M1 gate nie przejdzie |

## Consequences
**Positive:** zieleń/skóra nie są przemalowywane; ta sama klisza → prawie identity; ~0,3 s zamiast ~1 s; gładki LUT z konstrukcji (bez fitu siatki).
**Negative:** mniej elastyczny — na syntetycznym looku błąd 1,3% vs 0,3% transferu; nie odtworzy looków zależnych od treści (np. „tylko niebo cyjan”).
**Risks:** stałe (progi chromy, zakresy) dobrane na 6 zdjęciach → strojenie na pełnym zbiorze QA (E4.12).
