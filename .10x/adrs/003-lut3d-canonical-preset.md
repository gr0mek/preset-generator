# ADR-003: `Lut3D` jako jedyny kanoniczny format presetu; eksport = czyste serializery

**Status:** Accepted · **Data:** 2026-10-01 · **Feature:** mvp · **Author:** 10x-Team (Architect + Staff Engineer)

## Context
Eksportujemy do 3 formatów (później .drx i inne). Silnik może się zmienić (v2: neural). Podgląd musi pokazywać dokładnie to, co zostanie wyeksportowane.

## Decision
Jedyny wynik silnika: `Lut3D { size, data: Float32Array (RGB, R-fastest, [0,1]), meta }`, przestrzeń sRGB→sRGB. Podgląd WebGL2 używa tego samego `Lut3D` (tekstura 3D, trilinear). Strength = lerp(identity, LUT) — na GPU w podglądzie, wypalany przez `applyStrength(lut, s)` przed serializacją. Każdy format to czysta funkcja `Lut3D → Blob` w `src/export/<format>.ts` z parserem testowym (roundtrip). Resampling siatki (np. dla .xmp) — wspólna funkcja `resampleLut(lut, size)` (trilinear).

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Parametryczny preset (krzywe + HSL) jako model | Edytowalny, natywny dla LR | Nie oddaje transferu OT; różne semantyki w każdej aplikacji | Utrata jakości; ewentualnie v2 jako dodatkowy eksport |
| Eksport bezpośrednio z silnika per format | Mniej warstw | Sprzężenie silnika z formatami | Łamie izolację, utrudnia testy |

## Consequences
**Positive:** WYSIWYG podgląd=eksport; nowy format = nowy plik + test; silnik wymienialny.
**Negative:** .xmp z LUT nie jest edytowalny suwakami LR (poza Amount).
**Risks:** różnice interpolacji (trilinear vs tetrahedral) między aplikacjami → akceptowalne przy 33³, sprawdzane w macierzy kompatybilności.

## Dependencies
Zależy od ADR-002. Ogranicza: każdy przyszły silnik musi zwracać `Lut3D`.
