# Architect — mvp

ADR: 001 (client-side), 002 (silnik), 003 (Lut3D kanoniczny). Szczegóły modułów: spec §3.

## Granice modułów (reguła zależności)
`ui → app → {io, engine(worker), preview, scopes, export}`; `preview/export → engine/types` tylko typy. `engine` nie importuje niczego z DOM/React. `export` nie zna algorytmu. Wymuszone przez `eslint-plugin-boundaries`.

## Kontrakty
- `io.loadImage(file) → Promise<LoadedImage { bitmap, width, height, analysis: ImageData(512), preview: ImageBitmap(2048) }>` — rzuca `ImageError { code: 'UNSUPPORTED'|'TOO_LARGE'|'DECODE_FAILED' }`.
- `engine.computeLut(ref: ImageData, target: ImageData, opts?, onProgress?) → Promise<EngineResult { lut: Lut3D, warnings: EngineWarning[], stats }>`; anulowanie przez `AbortSignal` (terminate workera).
- `preview.createRenderer(canvas) → { setImage, setLut, setStrength, setSplit, readPixels }`.
- `export.toCube|to3dl|toXmp(lut, meta) → Blob`; `toZip(lut, meta) → Blob`.

## Tryby awarii
Patrz spec §6. Worker timeout 15 s. Context lost WebGL → reinit renderera. Brak WebGL2 → Canvas 2D CPU fallback (1024 px).

## Wydajność
Analiza ≤ 3 s p50; podgląd 2048 px ≥ 30 fps; pamięć: oryginał nie jest trzymany w pełnej rozdzielczości poza ImageBitmap.
