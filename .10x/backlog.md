# Preset AI — Backlog MVP

**Feature:** `mvp` · Spec: `specs/2026-10-01-presetai-mvp-design.md` · ADR-001/002/003
**Jednostka:** ½d = pół dnia pracy dewelopera. Każde zadanie ≤ ½d (większe pocięte).
**Statusy:** ☐ todo · ◐ w toku · ☑ done · ⛔ zablokowane

## Podsumowanie

| Epika | Nazwa | Zadań | Szac. | Milestone |
|---|---|---|---|---|
| E0 | Setup projektu i CI | 6 | 3d | M1 |
| E1 | Spike'i ryzyka | 6 | 3d | M1 |
| E3 | IO — wczytywanie obrazów | 4 | 2d | M1 |
| E4 | Silnik transferu koloru | 12 | 6d | M1 |
| E7a | Eksport .cube | 2 | 1d | M1 |
| E2 | Port design systemu | 7 | 3,5d | M2 |
| E5 | Podgląd WebGL2 | 6 | 3d | M2 |
| E6 | Scopes i wizualizacje | 5 | 2,5d | M2 |
| E8 | Ekrany i flow | 7 | 3,5d | M2 |
| E7b | Eksport .3dl / .xmp / ZIP | 6 | 3d | M3 |
| E9 | Landing, treści, prawa | 5 | 2,5d | M3 |
| E10 | QA, bezpieczeństwo, release | 9 | 4,5d | M3 |
| | **Razem** | **75** | **~37,5d** | |

Z buforem 20% → **~45 dni roboczych dla 1 dewelopera (~9 tyg.)** lub **~5 tyg. dla 2 deweloperów** (ścieżka silnika równolegle z UI). Time-box CTO (5 tyg.) zakłada 2 osoby lub cięcie zakresu (patrz „Cięcia awaryjne”).

## Milestones

- **M1 — Silnik zweryfikowany (koniec tyg. 2).** LUT .cube z pary obrazów, sprawdzony w Resolve na 10 parach QA. **Gate go/no-go:** ≥ 8/10 par ≥ 4/5. Jeśli nie — wracamy do ADR-002 (strojenie / neural), zanim zbudujemy resztę.
- **M2 — Editor end-to-end (koniec tyg. 4).** Drop → analiza → podgląd + strength + scopes → eksport .cube, w docelowym designie.
- **M3 — Public beta (koniec tyg. 5–6).** Wszystkie formaty, landing, QA, macierz kompatybilności, deploy produkcyjny.

## Ścieżka krytyczna

`E0.1 → E0.2 → E4.1…E4.12 → E7a → [M1 gate] → E8 → E7b → E10 → release`
Równolegle: E1 (spike'i) od dnia 1; E2/E5/E6 (UI) od tygodnia 2 przez drugą osobę.

---

## E0 — Setup projektu i CI (M1)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E0.1 | Repo GitHub, Vite + React 18 + TS strict, struktura `src/{ui,app,io,engine,preview,scopes,export}` | ½d | — | `npm run dev` działa; tsconfig strict + noUncheckedIndexedAccess |
| E0.2 | ESLint (typescript-eslint, react-hooks, boundaries) + Prettier + husky/lint-staged | ½d | E0.1 | Reguła boundaries blokuje import DOM/React w `engine/` |
| E0.3 | Vitest + coverage, katalog `test/fixtures/` | ½d | E0.1 | Przykładowy test przechodzi w CI |
| E0.4 | Playwright (Chromium + WebKit), smoke test strony | ½d | E0.1 | `npm run e2e` lokalnie i w CI |
| E0.5 | GitHub Actions: lint, typecheck, unit, build, e2e | ½d | E0.2–E0.4 | PR blokowany przy czerwonym CI |
| E0.6 | Cloudflare Pages: preview deploy per PR + produkcja z `main`; nagłówki CSP (`_headers`) | ½d | E0.5 | URL preview w PR; CSP `default-src 'self'`, `worker-src 'self' blob:` |

## E1 — Spike'i ryzyka (M1, start dnia 1)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E1.1 | **S1 .xmp (cz. 1):** analiza formatu profilu kreatywnego Camera Raw (`crs:RGBTable`, `crs:Table_<MD5>`), kodowanie wg DNG SDK `dng_big_table` (zlib + ASCII85-like), dopuszczalne rozmiary siatki | ½d | — | Notatka w `decisions/senior-engineer/mvp.md`: struktura XML, algorytm kodowania, rozmiar siatki |
| E1.2 | **S1 .xmp (cz. 2):** PoC — wygenerować .xmp z LUT identity i z LUT „sepia”, zaimportować w Lightroom Classic + ACR | ½d | E1.1 | Profil widoczny w przeglądarce profili, efekt zgodny z .cube w Photoshopie, Amount działa. **Jeśli fail → decyzja fallback (CTO)** |
| E1.3 | **S2 .3dl:** ustalić kolejność osi i nagłówek akceptowany przez Resolve, Nuke/Flame (jeśli dostępne), Premiere | ½d | — | Testowy LUT „swap R/B” importuje się i daje oczekiwany wynik |
| E1.4 | **S3 benchmark (cz. 1):** prototyp MKL + sliced-OT (12 iter.) na 512 px w Workerze, pomiar czasu | ½d | E0.1 | Czas p50 na M1 i średnim laptopie Windows |
| E1.5 | **S3 benchmark (cz. 2):** prototyp CG dla fitu siatki 33³, pomiar czasu + decyzja TS vs WASM | ½d | E1.4 | Całość ≤ 3 s → TS; inaczej zadanie WASM dopisane do backlogu |
| E1.6 | Zebranie zbioru QA: 10 par referencja/target (własne lub licencjonowane), opis oczekiwanego looku | ½d | — | `test/fixtures/qa-pairs/` + `README` z licencjami |

## E3 — IO: wczytywanie obrazów (M1)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E3.1 | `loadImage(file)`: walidacja typu (JPEG/PNG/WebP po magic bytes), limit 60 MB | ½d | E0.3 | `ImageError('UNSUPPORTED'|'TOO_LARGE')` + testy |
| E3.2 | Dekodowanie `createImageBitmap` z `imageOrientation: 'from-image'`, limit 50 MP (po odczycie wymiarów z nagłówka, przed pełnym dekodowaniem) | ½d | E3.1 | Zdjęcie pionowe z EXIF wyświetla się poprawnie; 60 MP odrzucone bez OOM |
| E3.3 | Downsample: 512 px (analiza, `ImageData`) i 2048 px (podgląd, `ImageBitmap`), wysokiej jakości (wieloetapowe zmniejszanie) | ½d | E3.2 | Brak aliasingu na fixture z drobnym wzorem |
| E3.4 | Testy IO na fixtures (uszkodzony plik, PNG z alfą, CMYK JPEG, 16-bit PNG) | ½d | E3.3 | Każdy przypadek ma zdefiniowane zachowanie i test |

## E4 — Silnik transferu koloru (M1)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E4.1 | Typy: `Lut3D`, `EngineOptions`, `EngineResult`, `EngineWarning`, `EngineError`; `identityLut(size)` | ½d | E0.2 | Typy w `engine/types.ts`; test identity |
| E4.2 | Konwersje: sRGB↔linear, linear↔Oklab (Float32Array, bez alokacji w pętli) | ½d | E4.1 | Roundtrip błąd < 1e-5 na 10⁵ losowych kolorach |
| E4.3 | Ekstrakcja próbek: Oklab z `ImageData`, maskowanie skrajnych luminancji, alfa | ½d | E4.2 | Test maski na syntetycznym obrazie |
| E4.4 | Statystyki: średnia, kowariancja 3×3, eigendecomposition 3×3 (Jacobi), sqrtm | ½d | E4.3 | Test na znanych macierzach |
| E4.5 | MKL: transformacja liniowa target→ref | ½d | E4.4 | Odtwarza znane przekształcenie liniowe (błąd < 1e-3) |
| E4.6 | Sliced-OT: seeded RNG (`mulberry32`), losowe rotacje, dopasowanie histogramów 1D, relaksacja | ½d | E4.5 | Sliced-Wasserstein do ref maleje monotonicznie (test); deterministyczny przy tym samym seed |
| E4.7 | Fit siatki (cz. 1): trilinear splat próbek target→wynik na siatkę 33³, prior MKL | ½d | E4.6 | Test: dla danych z mapy liniowej siatka = mapa liniowa |
| E4.8 | Fit siatki (cz. 2): Laplacian + solver CG, parametr λ | ½d | E4.7 | Brak NaN; gładkość (max 2. różnica) poniżej progu; zbieżność ≤ 200 iter. |
| E4.9 | Post: Oklab→sRGB węzłów, soft-clip, walidacja monotoniczności luminancji → warnings | ½d | E4.8 | Test na parze ekstremalnej: brak wartości poza [0,1] |
| E4.10 | Fallback Reinhard dla degeneratywnej referencji + `EngineWarning('LOW_VARIANCE')` | ½d | E4.5 | Ref jednolita szara → fallback + warning |
| E4.11 | Worker (Comlink): `computeLut` z progress, AbortSignal, timeout 15 s | ½d | E4.9 | Anulowanie w trakcie nie zostawia wiszącego workera |
| E4.12 | Harness M1: skrypt/strona dev, która przelicza 10 par QA i zapisuje .cube + porównania; strojenie domyślnych λ/iteracji/relaksacji | ½d | E4.11, E7a.1, E1.6 | Pliki do oceny w Resolve; domyślne parametry zapisane w `decisions/sde/mvp.md` |

## E7a — Eksport .cube (M1)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E7a.1 | `applyStrength`, `resampleLut`, `toCube` (TITLE, LUT_3D_SIZE, DOMAIN, R-fastest, 6 miejsc) | ½d | E4.1 | Plik otwiera się w Resolve |
| E7a.2 | Parser .cube do testów + roundtrip test; golden tests silnika (hash/tolerancja dla par QA) | ½d | E7a.1, E4.12 | Regresja silnika wykrywana w CI |

**→ M1 GATE: ocena 10 par QA w Resolve (Gromek + Ola). ≥ 8/10 par ≥ 4/5 = GO.**

## E2 — Port design systemu (M2) — ⛔ wymaga pliku prototypu

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E2.1 | Ekstrakcja tokenów (kolory, typografia, spacing, radius) do CSS variables; 3 motywy dark/grey/light + przełącznik | ½d | E0.1, prototyp | Zmiana motywu bez przeładowania; zapamiętanie w localStorage |
| E2.2 | Fonty i assety: base64 → pliki w `public/`, optymalizacja (AVIF/WebP) | ½d | E2.1 | Brak base64 > 10 KB w bundlu |
| E2.3 | Komponenty bazowe: Button, Card, Slider, Tabs, Toast/Banner | ½d | E2.1 | Storybook-lite (strona `/dev/ui`) |
| E2.4 | DropTile + DropZoneEmpty (drag&drop, picker, miniatura, ×, stany błędu, klawiatura) | ½d | E2.3 | Obsługa klawiatury i czytnika ekranu |
| E2.5 | BeforeAfterSlider (mysz, dotyk, klawiatura) | ½d | E2.3 | Działa na touch i klawiaturze |
| E2.6 | Karty eksportu (format, opis, przycisk pobrania, instrukcja instalacji) | ½d | E2.3 | Zgodne z prototypem |
| E2.7 | Audyt kontrastu WCAG AA w 3 motywach | ½d | E2.1–E2.6 | Raport, poprawki tokenów |

## E5 — Podgląd WebGL2 (M2)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E5.1 | Renderer: kontekst WebGL2, tekstura obrazu, quad, dopasowanie do kontenera (DPR) | ½d | E0.1 | Obraz wyświetla się ostro na Retina |
| E5.2 | LUT jako tekstura 3D (RGB32F/RGB16F, LINEAR), shader z korekcją half-texel | ½d | E5.1, E4.1 | Identity LUT = obraz bit-identyczny (± 1/255) |
| E5.3 | Strength (mix z identity) jako uniform; split before/after w shaderze | ½d | E5.2 | ≥ 30 fps przy przeciąganiu suwaka (2048 px) |
| E5.4 | Zgodność podgląd vs eksport: test porównujący piksele z GPU i CPU-apply .cube | ½d | E5.3, E7a.1 | Różnica ≤ 2/255 |
| E5.5 | Obsługa `webglcontextlost` / restore | ½d | E5.3 | Symulacja utraty kontekstu nie psuje sesji |
| E5.6 | Fallback Canvas 2D (CPU trilinear, 1024 px) przy braku WebGL2 + banner | ½d | E5.2 | Działa przy wyłączonym WebGL2 |

## E6 — Scopes i wizualizacje (M2)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E6.1 | Odczyt pomniejszonego bufora podglądu (256 px) do scopes, throttling (rAF) | ½d | E5.3 | Brak spadku fps podglądu |
| E6.2 | Waveform (luma) — port widgetu z prototypu na prawdziwe dane | ½d | E6.1, E2.1 | Zmienia się przy strength |
| E6.3 | Vectorscope — port widgetu na prawdziwe dane | ½d | E6.1, E2.1 | Test na kolorach referencyjnych (R/G/B/Y/C/M w poprawnych kątach) |
| E6.4 | Wizualizacja LUT read-only: krzywe tonalne (przekątna szarości LUT) + LUT cube 3D | ½d | E4.1, E2.1 | Zgodne z wyeksportowanym LUT |
| E6.5 | Wizualizacja read-only: koła kolorów (shadows/mids/highlights shift) + pasma HSL wyliczone z LUT | ½d | E4.1, E2.1 | Opisane jako „analiza”, nie kontrolki |

## E8 — Ekrany i flow (M2)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E8.1 | Routing (Landing / Editor / Export), store `useSession` (Zustand) | ½d | E0.1 | Stan przetrwa przejście Editor ↔ Export |
| E8.2 | Editor: layout 3-panelowy, podpięcie DropTile → io → engine (auto-start analizy po 2 plikach) | ½d | E2.4, E3.3, E4.11 | Analiza startuje automatycznie; podmiana pliku anuluje poprzednią |
| E8.3 | Editor: stany ładowania/progres/błędy/ostrzeżenia (mapowanie błędów `ui/errors.ts`) | ½d | E8.2 | Każdy `ImageError`/`EngineError`/warning ma komunikat |
| E8.4 | Editor: podgląd + strength + before/after + scopes w panelach | ½d | E5.3, E6.2, E6.3 | US2–US4 spełnione |
| E8.5 | Export: galeria wyniku, anatomia presetu (E6.4/E6.5), karty pobrania .cube | ½d | E2.6, E7a.1 | US5 dla .cube |
| E8.6 | Komunikaty: prywatność (US7), materiał log (US8) | ½d | E8.3 | Teksty w słowniku |
| E8.7 | Słownik tekstów EN (+ PL) w jednym pliku, przełącznik języka | ½d | E8.6 | Brak hardcodowanych stringów w komponentach |

**→ M2: demo end-to-end w docelowym designie.**

## E7b — Eksport .3dl / .xmp / ZIP (M3)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E7b.1 | `to3dl` (33, mesh 0…1023, 12-bit, kolejność wg S2) + parser testowy + roundtrip | ½d | E1.3, E7a.1 | Import w Resolve = wynik .cube |
| E7b.2 | `toXmp` (cz. 1): kodowanie tabeli (zlib + ASCII85-like), MD5 klucz, resampling do wymaganego rozmiaru | ½d | E1.2 | Unit test dekoduje to, co zakodował |
| E7b.3 | `toXmp` (cz. 2): szablon XML profilu (nazwa, grupa „Preset AI”, SupportsAmount, Amount z strength) | ½d | E7b.2 | Import w LR Classic, LR, ACR; Amount 0–200 działa |
| E7b.4 | `toZip`: 3 formaty + README.txt z instrukcjami instalacji (fflate) | ½d | E7b.1, E7b.3 | ZIP otwiera się na macOS i Windows |
| E7b.5 | Nazewnictwo plików (slug ASCII z nazwy ref + data), metadane (TITLE / nazwa profilu) | ½d | E7b.4 | Polskie znaki i spacje → poprawny slug |
| E7b.6 | Karty pobrania .3dl / .xmp / ZIP w ekranie Export + instrukcje per aplikacja | ½d | E7b.4, E8.5 | US5, US6 spełnione |

## E9 — Landing, treści, prawa (M3)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E9.1 | Landing: hero, pasek formatów, how-it-works, CTA — port z prototypu | ½d | E2.3 | Zgodne z prototypem, responsywne |
| E9.2 | Galeria przykładów: **własne/licencjonowane** pary before/after (zastąpić still „Asteroid City”) | ½d | E1.6, E4.12 | Każdy obraz ma udokumentowane prawa |
| E9.3 | Sekcje: prywatność („zdjęcia nie opuszczają przeglądarki”), FAQ (log, formaty, instalacja) | ½d | E9.1 | Teksty EN + PL |
| E9.4 | SEO/meta: tytuły, OG image, favicon, sitemap, robots | ½d | E9.1 | Lighthouse SEO ≥ 95 |
| E9.5 | Analityka bez cookies (Plausible — po decyzji), zdarzenia: `analysis_done`, `export_<format>`, `engine_error` | ½d | E8.5, decyzja | Brak cookies; zdarzenia widoczne w panelu |

## E10 — QA, bezpieczeństwo, release (M3)

| ID | Zadanie | Szac. | Zależy od | Kryteria akceptacji |
|---|---|---|---|---|
| E10.1 | E2E: pełny flow (drop → podgląd → eksport każdego formatu → walidacja pliku) Chromium + WebKit | ½d | E7b.6 | Zielone w CI |
| E10.2 | E2E prywatności: brak requestów sieciowych z danymi obrazów (monitoring sieci w Playwright) | ½d | E10.1 | Test przechodzi |
| E10.3 | Macierz kompatybilności (cz. 1): Resolve, Premiere, FCP | ½d | E7b.4 | Raport w `.10x/reviews/` |
| E10.4 | Macierz kompatybilności (cz. 2): LR Classic, LR, ACR, Photoshop Color Lookup | ½d | E7b.4 | Raport w `.10x/reviews/` |
| E10.5 | Test wydajności na sprzęcie referencyjnym + słabszym laptopie; Safari | ½d | E8.4 | Analiza ≤ 3 s p50, podgląd ≥ 30 fps |
| E10.6 | Przegląd bezpieczeństwa: CSP, limity wejścia (decompression bomb), zależności (`npm audit`), brak sekretów | ½d | E0.6, E3.2 | Raport security w `.10x/reviews/` |
| E10.7 | Visual QA: ocena 10 par w finalnej aplikacji + test „pierwszy eksport < 60 s” z 5 osobami | ½d | E10.1 | Kryteria sukcesu §9.1 i §9.4 |
| E10.8 | Bugfix buffer | ½d | E10.1–E10.7 | Brak bugów P0/P1 |
| E10.9 | Release: domena, deploy produkcyjny, tag v0.1.0, monitoring (uptime CF + zdarzenia błędów) | ½d | E10.8 | Strona publiczna; runbook w `decisions/sre/mvp.md` |

**→ M3: public beta.**

---

## Cięcia awaryjne (jeśli time-box się nie domyka)

Kolejność cięcia, od najmniej bolesnego:
1. E6.5 (koła/HSL read-only) → v1.1
2. E5.6 (fallback Canvas 2D) → zastąpiony komunikatem „wymagany WebGL2”
3. E8.7 PL wersja językowa → v1.1 (zostaje EN)
4. .3dl (E1.3, E7b.1) → v1.1
5. **Nie tniemy:** silnik + gate M1, .cube, .xmp, prywatność, E10.1–E10.4.

## Otwarte decyzje (właściciel: Gromek)

| # | Decyzja | Rekomendacja | Blokuje |
|---|---|---|---|
| D1 | Dostawca analityki | Plausible (EU, bez cookies) | E9.5 |
| D2 | Widgety krzywych/kół/HSL tylko do odczytu w MVP | Tak (edycja → v2) | E6.4, E6.5 |
| D3 | Język domyślny | EN + PL | E8.7 |
| D4 | Domena / nazwa produktu na launch | — | E10.9 |
| D5 | Przesłanie pliku prototypu | — | cała E2 |
| D6 | Zespół: 1 czy 2 deweloperów | 2 (time-box 5 tyg.) | harmonogram |

## Backlog v2 (poza MVP)

.drx · materiał log (input transforms: S-Log3, V-Log, LogC, Rec.709 conversion) · RAW/HEIC/TIFF 16-bit · tryb „tylko referencja” · silnik neuronowy (ONNX/WebGPU) · edytowalne krzywe/koła/HSL na LUT · lokalna maska (skóra/niebo) · konta + płatności (lekki backend, osobny ADR) · biblioteka presetów · eksport parametryczny .xmp (edytowalne suwaki LR).
