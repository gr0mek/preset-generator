# Preset AI — MVP Design Spec

**Data:** 2026-10-01 · **Status:** Zatwierdzony kierunek (Phase 0) · **Feature slug:** `mvp`

## 1. Cel

Aplikacja webowa, która z pary obrazów **referencja (look) + zdjęcie użytkownika** wylicza transfer koloru, pokazuje podgląd na żywo i eksportuje preset jako **.cube, .3dl, .xmp** (Lightroom/ACR). Całe przetwarzanie lokalnie w przeglądarce. Darmowa, bez kont.

## 2. Zakres

**W MVP**
- Wczytanie 2 obrazów (drag & drop / file picker): JPEG, PNG, WebP; max 50 MP, max 60 MB na plik.
- Silnik transferu koloru (Oklab, MKL + sliced-OT, wygładzony LUT 33³) w Web Workerze.
- Podgląd WebGL2 na pełnej rozdzielczości, suwak *strength* 0–100%, before/after slider.
- Scopes: waveform (luma), vectorscope — liczone z podglądu.
- Eksport: `.cube` (33³), `.3dl` (33³, 12-bit), `.xmp` (profil kreatywny LR/ACR z osadzonym RGBTable, z obsługą suwaka Amount), ZIP „wszystkie formaty”.
- Landing + Editor + Export (port design systemu z prototypu, motywy dark/grey/light).
- Analityka bez cookies (zdarzenia: analiza zakończona, eksport per format).

**Poza MVP (v2+)**
- `.drx` (Resolve still), materiał log (S-Log/V-Log/LogC — input transform), RAW/HEIC/TIFF 16-bit.
- Tryb „tylko referencja” (uniwersalny look), model neuronowy (ONNX).
- Konta, płatności, zapisywanie projektów, biblioteka presetów.
- Ręczne korekty (krzywe/koła kolorów edytowalne) — w MVP widgety z prototypu są **tylko wizualizacją** LUT, nie kontrolkami. *(Wyjątek: strength.)*

## 3. Architektura

Statyczne SPA: **Vite + React 18 + TypeScript (strict)**, hosting Cloudflare Pages, CI GitHub Actions.

| Moduł | Odpowiedzialność | Zależy od |
|---|---|---|
| `src/ui/` | Design system (tokeny, motywy, komponenty), ekrany Landing / Editor / Export | `app/` |
| `src/app/` | Stan aplikacji (Zustand), orkiestracja: io → engine → preview → export | wszystkie |
| `src/io/` | Dekodowanie (`createImageBitmap` + EXIF orientation), walidacja rozmiaru, downsample do 512 px (analiza) i 2048 px (podgląd) | — |
| `src/engine/` | Czysty TS, bez DOM. `computeLut(ref, target, opts) → Lut3D`. Uruchamiany w Workerze (Comlink) | — |
| `src/preview/` | WebGL2: LUT jako tekstura 3D, trilinear, mix z identity wg strength; render before/after | `engine` (typ `Lut3D`) |
| `src/scopes/` | Waveform + vectorscope z bufora podglądu (Canvas 2D lub WebGL) | `preview` |
| `src/export/` | Serializery `toCube`, `to3dl`, `toXmp`, `toZip` — czyste funkcje `Lut3D → Blob` | `engine` (typ) |

**Kontrakt centralny:** `Lut3D = { size: number; data: Float32Array /* RGB, R-fastest, [0,1] */; meta: { title, sourceRef, createdAt } }`. Wszystko po silniku operuje wyłącznie na `Lut3D` — eksport i podgląd nie znają algorytmu.

**Przepływ:** drop ref + target → `io` (walidacja, downsample) → Worker `engine.computeLut` (progress events, anulowanie) → `Lut3D` → `preview` (strength na GPU, bez przeliczania) → `export` (strength wypalony w LUT przy eksporcie; w .xmp dodatkowo jako Amount).

**Założenie kolorystyczne:** wejście i wyjście display-referred **sRGB / Rec.709 gamma**. LUT: sRGB-in → sRGB-out. Komunikat w UI: „dla materiału log zastosuj najpierw konwersję do Rec.709”.

## 4. Silnik (engine)

1. **Przygotowanie:** obrazy 512 px (dłuższy bok), sRGB → linear → Oklab. Pomijamy piksele prześwietlone/zablokowane (L < 0.02 lub > 0.98 w obu kanałach) przy estymacji statystyk.
2. **MKL (Monge–Kantorovich linear):** dopasowanie średniej i kowariancji Oklab target → ref. Daje globalną, gładką mapę liniową `M`, zdefiniowaną w całej przestrzeni (prior dla LUT).
3. **Sliced OT (IDT, Pitié):** na wyniku MKL, `N=12` iteracji: losowa rotacja 3D (seeded RNG → deterministyczny wynik), dopasowanie histogramów 1D wzdłuż każdej osi, relaksacja 0.5–0.7. Łapie przesunięcia zależne od barwy/jasności.
4. **Dopasowanie LUT 33³:** próbki (kolor target → kolor po OT). Regularyzowana regresja na siatce: term danych (trilinear splat) + Laplacian smoothness (λ) + prior = mapa MKL (dla węzłów bez danych). Rozwiązanie: conjugate gradient, ≤ 200 iteracji.
5. **Post:** konwersja węzłów Oklab → sRGB, soft-clip do [0,1], walidacja (brak NaN, monotoniczność luminancji — ostrzeżenie przy inwersji).
6. **Fallback:** referencja niemal monochromatyczna / zbyt mała wariancja → tylko MKL na L + chroma bias (Reinhard), komunikat w UI.

**Parametry ekspozycji dla dev (nie w UI MVP):** `iterations`, `lambda`, `relaxation`, `seed` — w `EngineOptions`, z wartościami domyślnymi dostrojonymi na zbiorze QA.

**Budżet wydajności:** ≤ 3 s na laptopie klasy M1 / i5-2020 dla pary 512 px; progres co iterację; anulowanie przy podmianie pliku.

## 5. Eksport

| Format | Specyfikacja | Uwagi / ryzyko |
|---|---|---|
| `.cube` | Adobe/Resolve: `TITLE`, `LUT_3D_SIZE 33`, `DOMAIN_MIN/MAX`, R-fastest, 6 miejsc po przecinku | Niskie ryzyko |
| `.3dl` | Nagłówek mesh 33 wartości (0…1023), wartości 12-bit (0…4095), kolejność B-fastest | **Kolejność osi do weryfikacji** w Resolve/Nuke (spike S2) |
| `.xmp` | Profil kreatywny Camera Raw: `crs:Look` + `crs:RGBTable` (MD5 klucz) + `crs:Table_<KEY>`; dane: zlib + kodowanie ASCII85-like wg DNG SDK (`dng_big_table`); `crs:SupportsAmount="True"` | **Najwyższe ryzyko** — spike S1 (time-box 1 dzień). Dopuszczalny rozmiar siatki do ustalenia (resampling LUT jeśli wymagany) |
| `.zip` | Wszystkie trzy + README.txt (jak zainstalować w LR/Resolve/Premiere/FCP) | `fflate` |

Nazwy plików: `presetai_<nazwa-ref>_<YYYYMMDD>.<ext>` (slug ASCII).

## 6. Obsługa błędów

| Sytuacja | Zachowanie |
|---|---|
| Nieobsługiwany format / uszkodzony plik | Komunikat inline w DropTile, plik odrzucony |
| > 50 MP lub > 60 MB | Odrzucenie z komunikatem (ochrona przed decompression bomb / OOM) |
| Brak WebGL2 | Fallback podglądu na Canvas 2D (CPU, 1024 px) + banner |
| Błąd / timeout Workera (> 15 s) | Komunikat + przycisk „spróbuj ponownie”, log zdarzenia |
| Degeneratywna referencja | Fallback silnika (sekcja 4.6) + ostrzeżenie |
| Wynik z NaN | Blokada eksportu, komunikat, zdarzenie analityczne |

## 7. Testowanie

- **Unit (Vitest):** konwersje kolorów (roundtrip < 1e-5), MKL odtwarza znane przekształcenie liniowe na danych syntetycznych, sliced-OT zmniejsza sliced-Wasserstein distance, LUT fit: gładkość i brak NaN, serializery: zapis → parsowanie → porównanie (tolerancja kwantyzacji).
- **Golden tests:** 10 par obrazów QA + stały seed → hash/tolerancja LUT (wykrywanie regresji silnika).
- **E2E (Playwright, Chromium + WebKit):** drop 2 plików → podgląd → eksport każdego formatu → walidacja pobranego pliku.
- **Macierz kompatybilności (manualna, przed releasem):** Resolve, Premiere Pro, Final Cut Pro, Lightroom Classic, Lightroom (cloud), ACR/Photoshop, Photoshop Color Lookup.
- **Visual QA:** zbiór 10 par (portret, krajobraz, noc, mieszane światło, ekstremalny teal-orange, ref B&W, still filmowy — **własne/licencjonowane obrazy**). Ocena 1–5 „zgodność z referencją” przez Gromka i Olę.

## 8. Prywatność, bezpieczeństwo, prawo

- Obrazy nigdy nie opuszczają przeglądarki — to kluczowa obietnica produktu (komunikat na landingu).
- Ścisły CSP (`default-src 'self'`, worker-src `'self' blob:`), brak zewnętrznych skryptów poza analityką bez cookies.
- Limity rozmiaru wejścia (sekcja 6).
- **Prawa do obrazów:** galeria i przykłady na stronie publicznej — wyłącznie własne lub licencjonowane kadry. Still z „Asteroid City” z prototypu **musi zostać zastąpiony** przed publikacją.
- Nazewnictwo: MVP jest algorytmiczne (optimal transport), nie ML. Komunikacja „AI” — świadoma decyzja marketingowa (patrz CTO decisions).

## 9. Kryteria sukcesu MVP

1. ≥ 8/10 par QA ocenionych ≥ 4/5.
2. Eksportowane pliki otwierają się poprawnie w 100% aplikacji z macierzy kompatybilności.
3. Analiza ≤ 3 s (p50) na sprzęcie referencyjnym; podgląd ≥ 30 fps przy zmianie strength.
4. Nowy użytkownik dochodzi do pierwszego eksportu w < 60 s (test z 5 osobami).
5. Po publicznym starcie (4 tyg.): ≥ 40% sesji z analizą kończy się eksportem.

## 10. Otwarte kwestie (do decyzji, nie blokują startu)

- Dostawca analityki: rekomendacja **Plausible (EU, bez cookies)**; alternatywa Cloudflare Web Analytics (brak custom events).
- Domena i nazwa produktu na launch.
- Plik prototypu — potrzebny do epiki E2 (port design systemu).
