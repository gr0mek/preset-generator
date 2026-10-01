# CTO — mvp

**Data:** 2026-10-01 · Spec: `specs/2026-10-01-presetai-mvp-design.md`

## Werdykt: BUILD (MVP, time-box ~5 tygodni)
- Problem: kolorysta/fotograf widzi look (kadr filmowy, zdjęcie) i chce go odtworzyć na swoim materiale. Dziś: ręczne grading lub generyczne paczki LUT.
- Konkurencja/buy: istnieją narzędzia do color match (Resolve Shot Match, Colourlab AI, wtyczki do Photoshopa, aplikacje mobilne). Wyróżnik: **zero instalacji, lokalnie w przeglądarce, prywatne, eksport do LR i wideo naraz, darmowe**. Brak gotowego komponentu do kupienia — rdzeń (OT + fit LUT) budujemy sami, biblioteki pomocnicze kupujemy/bierzemy OSS.

## Kierunek technologiczny
- Statyczne SPA: Vite + React + TS, Cloudflare Pages. Brak backendu w MVP → koszt infrastruktury ~0 zł.
- Silnik: algorytmiczny (Oklab, MKL, sliced-OT, regularized LUT). Neural/ONNX → v2, jeśli jakość OT okaże się niewystarczająca.
- OSS: Comlink (worker RPC), Zustand (stan), fflate (zip), pako lub fflate (zlib dla .xmp), Vitest, Playwright.

## Ryzyka strategiczne
| Ryzyko | Wpływ | Mitigacja |
|---|---|---|
| Jakość transferu „nie wow” | Wysoki — to produkt | Milestone M1 = silnik zweryfikowany na 10 parach zanim zbudujemy resztę UI |
| .xmp nie do wygenerowania | Średni — traci fotografów | Spike S1 w tygodniu 1; fallback: .xmp jako preset parametryczny (aproksymacja) lub instrukcja importu .cube przez Photoshop |
| Marka „AI” przy algorytmie bez ML | Reputacyjny | Komunikacja: „inteligentne dopasowanie koloru”; ML jako roadmap v2 |
| Prawa do obrazów w materiałach | Prawny | Tylko własne/licencjonowane kadry na stronie (zadanie w backlogu) |

## Koszt alternatywny
Czas Gromka/zespołu Double Trouble vs projekty komercyjne — dlatego twardy time-box i gate jakości po M1 (go/no-go).
