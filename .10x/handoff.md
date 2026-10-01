# Handoff → SDE (kontynuacja) / Gromek (M1 gate)

Stan: silnik działa end-to-end (worker + .cube), ~1 s w przeglądarce, testy zielone. ADR-004 zmienia metodę fit.

## Jak uruchomić
- `npm ci && npm run ci` — lint, typecheck, unit, build, e2e (lokalnie: `PW_CHROMIUM_PATH` jeśli Playwright nie ma własnej przeglądarki)
- `npm run lut -- ref.jpg target.jpg out/` — LUT .cube + podgląd (target | wynik | referencja)
- `npm run lut -- --batch test/fixtures/qa-pairs out/qa` — pary `<nazwa>_ref.jpg` + `<nazwa>_target.jpg`
- `npm run dev` + `npm run bench:browser` — benchmark w Chromium

## Następne zadania
1. E1.6 zbiór QA (Gromek) → E4.12 strojenie σ / priorWeight / otRelaxation → **M1 gate** (ocena w Resolve)
2. E3 IO (`src/io/`) — niezależne od M1
3. E1.1–E1.3 spike'i formatów (wymagają LR / Resolve)
4. E2 port designu — po otrzymaniu pliku prototypu
