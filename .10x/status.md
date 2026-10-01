# Status — Preset AI

**Phase:** 0 — Brainstorming (in progress)
**Started:** 2026-10-01

## Context
- A React single-artifact UI prototype exists (landing, editor w/ scopes, export page) — design reference only, analysis is mocked.
- Pre-development of the real application starts now.

## Open questions
- Product form / platform
- MVP scope

## Decided in brainstorming
- [2026-10-01] Platform: web app, image processing client-side in browser (no server for analysis).
- [2026-10-01] Engine mode: reference + target photo pair → color transfer (Lab stats + curves) baked to 3D LUT.
- [2026-10-01] MVP export: .cube, .3dl, .xmp (LR/ACR profile w/ embedded LUT). .drx deferred.
- [2026-10-01] Business model MVP: free, no accounts, static frontend only. Payments deferred to v2.
- [2026-10-01] Prototype: port design system/components/widgets into new Vite+TS project; logic rewritten for real engine. User to send prototype file.
