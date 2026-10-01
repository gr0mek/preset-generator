# ADR-001: Całe przetwarzanie obrazów po stronie klienta (statyczne SPA)

**Status:** Accepted · **Data:** 2026-10-01 · **Feature:** mvp · **Author:** 10x-Team (Architect + Staff Engineer)

## Context
MVP darmowe, bez kont. Obrazy użytkowników mogą być prywatne/komercyjne. Analiza na obrazach 512 px jest obliczeniowo lekka. Chcemy zerowego kosztu infrastruktury i szybkiego startu.

## Decision
Statyczne SPA (Vite + React + TS) na Cloudflare Pages. Dekodowanie, silnik i eksport w przeglądarce; silnik w Web Workerze (Comlink), podgląd w WebGL2. Brak backendu w MVP.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Backend (Python/NumPy, GPU) | Dowolne biblioteki, ML łatwiej | Koszt, RODO, upload dużych plików, latencja | Brak potrzeby dla algorytmu OT; prywatność to wyróżnik |
| Desktop (Tauri) | Natywna wydajność, RAW | Dystrybucja, podpisywanie, wolniejsza iteracja | Większe tarcie dla użytkownika i zespołu |
| WASM (Rust) dla silnika od dnia 1 | Szybszy | Złożoność toolchainu | TS wystarczy dla 512 px; WASM jako optymalizacja, jeśli benchmark S3 nie zmieści się w 3 s |

## Consequences
**Positive:** zero kosztów serwera, prywatność by design, offline-capable, prosta infrastruktura.
**Negative:** zależność od mocy urządzenia i WebGL2; brak telemetrii jakości poza analityką zdarzeń; ML w v2 wymaga pobierania modelu.
**Risks:** słabe urządzenia/mobile → limit rozdzielczości, fallback Canvas 2D; Safari quirks → E2E na WebKit.

## Dependencies
Ogranicza: płatności v2 wymagają lekkiego backendu (osobny ADR). Zależy od: WebGL2, Web Workers, `createImageBitmap`.
