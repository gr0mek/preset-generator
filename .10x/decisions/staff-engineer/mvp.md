# Staff Engineer — mvp

## Standardy kodu
- TypeScript `strict`, `noUncheckedIndexedAccess`. ESLint (typescript-eslint, react-hooks, boundaries) + Prettier. Brak `any` w `engine/` i `export/`.
- Struktura: `src/{ui,app,io,engine,preview,scopes,export}`, testy obok kodu (`*.test.ts`), fixtures w `test/fixtures/`.
- Matematyka: `Float32Array` w hot paths, bez alokacji w pętlach; funkcje czyste; seeded RNG (`mulberry32`) wstrzykiwany.
- Stan: Zustand, jeden store `useSession` (pliki, status analizy, lut, strength, warnings). Komponenty UI bez logiki domenowej.
- Worker: Comlink, `new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })`.

## Cross-cutting
- **Błędy:** typowane klasy błędów per moduł (`ImageError`, `EngineError`, `ExportError`), mapowane na komunikaty w jednym miejscu (`ui/errors.ts`, PL/EN-ready).
- **Logowanie:** `console` tylko w dev; w prod zdarzenia analityczne (bez danych obrazów).
- **i18n:** teksty w jednym pliku słownika od dnia 1 (EN domyślnie, PL drugi) — decyzja do potwierdzenia.
- **Dostępność:** focusable DropTile, obsługa klawiatury suwaków, kontrast WCAG AA w 3 motywach.

## Reużycie z prototypu
Tokeny (kolory, typografia, spacing, 3 motywy) → CSS variables; komponenty DropTile, DropZoneEmpty, BeforeAfterSlider, karty eksportu; widgety wizualizacji (krzywe, koła, vectorscope, waveform, LUT cube) → przepięte na dane z `Lut3D`/podglądu. Obrazy base64 → zwykłe assety w `public/` (i zastąpione licencjonowanymi).
