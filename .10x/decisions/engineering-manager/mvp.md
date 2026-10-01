# Engineering Manager — mvp

Pełny backlog: [`../../backlog.md`](../../backlog.md) — 75 zadań × ½d = 37,5d; z buforem 20% ≈ 45d.

## Plan dostarczenia (2 deweloperów: A = silnik/eksport, B = UI)
| Tydzień | Dev A | Dev B | Wynik |
|---|---|---|---|
| 1 | E0, E1.1–E1.5 (spike'i) | E1.6 (zbiór QA), E3 (IO) | Repo + CI + decyzje ryzyk |
| 2 | E4 (silnik), E7a | E2 (design system — wymaga prototypu) | **M1 gate** (koniec tyg.) |
| 3 | E7b.1–E7b.3 | E5 (podgląd), E6.1–E6.3 | |
| 4 | E7b.4–E7b.6, E6.4–E6.5 | E8 (flow) | **M2** demo |
| 5 | E10.1–E10.6 | E9 (landing), E10.7 | |
| 6 (bufor) | E10.8–E10.9 | poprawki | **M3** public beta |

Przy 1 deweloperze: ta sama kolejność, ~9 tygodni; M1 gate po ~2,5 tyg.

## Ryzyka harmonogramu
| Ryzyko | Prawdop. | Mitigacja |
|---|---|---|
| S1 .xmp nie działa | Średnie | Wynik spike'a w tyg. 1 → decyzja fallback przed planowaniem E7b |
| Silnik nie przechodzi gate'u M1 | Średnie | UI nie zależy od algorytmu (ADR-003) — dev B kontynuuje; dev A wraca do ADR-002 |
| Brak pliku prototypu | Wysokie (dziś) | E2 zablokowane; B zaczyna od E3/E5 |
| Wydajność silnika w TS | Niskie | S3 w tyg. 1, opcja WASM |

## Rytm
Tygodniowe demo (piątek), status w `.10x/status.md`, gate M1 = spotkanie oceny z Gromkiem i Olą.
