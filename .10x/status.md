# Status — Preset AI

**Phase:** 4 — Implementation (w toku) · M1 w toku
**Feature:** `mvp` · Spec: `.10x/specs/2026-10-01-presetai-mvp-design.md`

## Decyzje z brainstormingu (2026-10-01)
- Platforma: web app, przetwarzanie w przeglądarce.
- Silnik: para referencja + zdjęcie → Oklab, MKL + sliced-OT → wygładzony LUT 33³, suwak strength.
- Eksport MVP: .cube, .3dl, .xmp. .drx → v2.
- Model: darmowe, bez kont. Płatności → v2.
- Prototyp: port design systemu do Vite+TS, nowa logika.

## Fazy
- [x] 0 Brainstorming
- [x] 1 Strategy
- [x] 2 Design
- [x] 3 Planning
- [ ] 4 Implementation (w toku)
- [ ] 5 Verification
- [ ] 6 Delivery


## Postęp implementacji
Backlog: `.10x/backlog.md` — ☑ 18 · ◐ 4 · ☐ 53.
- ☑ Setup (E0.1–E0.4), silnik + worker (E4.1–E4.11), .cube (E7a.1), benchmark (E1.4/E1.5)
- ◐ CI/deploy (czeka na GitHub + Cloudflare), harness M1 (czeka na zbiór QA), golden tests
- Testy: 29 unit + 1 e2e, wszystkie zielone; `npm run ci` zielone lokalnie
- ADR-004: zmiana metody dopasowania LUT

## Blokery / potrzebne od Gromka
1. Zbiór QA: 10 par referencja/target (E1.6) → M1 gate
2. Testy formatów na jego sprzęcie: Lightroom (.xmp, S1), Resolve (.3dl, S2; .cube z harnessu)
3. Dostęp: repo GitHub + Cloudflare Pages (E0.5/E0.6)
4. Plik prototypu (E2)

## Otwarte decyzje
D1 analityka · D2 widgety read-only · D3 język · D4 domena · D5 plik prototypu · D6 skład zespołu (szczegóły w backlog.md)
