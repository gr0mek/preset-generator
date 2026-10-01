# Product Manager — mvp

## Persony
1. **Fotograf hybrydowy / content creator** — Lightroom, chce „ten look z filmu” na swoich zdjęciach. Format: .xmp.
2. **Montażysta / kolorysta indie** — Resolve/Premiere/FCP, materiał Rec.709. Format: .cube/.3dl.

## User stories (MVP)
| ID | Story | Kryteria akceptacji |
|---|---|---|
| US1 | Jako użytkownik wrzucam referencję i swoje zdjęcie, żeby dostać dopasowany look | Drag&drop i picker; JPEG/PNG/WebP; walidacja rozmiaru; miniatury w DropTile; usunięcie (×) |
| US2 | Widzę wynik od razu i porównuję z oryginałem | Analiza ≤ 3 s z progresem; before/after slider; podgląd pełnej rozdzielczości |
| US3 | Reguluję siłę efektu | Suwak 0–100%, ≥ 30 fps, wartość wypalana w eksporcie |
| US4 | Widzę scopes, żeby ocenić technicznie | Waveform + vectorscope, aktualizacja przy zmianie strength |
| US5 | Pobieram preset w formacie mojego programu | .cube, .3dl, .xmp, ZIP wszystkich; poprawne otwarcie w macierzy kompatybilności |
| US6 | Wiem, jak zainstalować preset | Karta eksportu z krótką instrukcją per aplikacja + README w ZIP |
| US7 | Mam pewność, że moje zdjęcia są prywatne | Komunikat na landingu i w edytorze; brak requestów z danymi obrazów (test E2E) |
| US8 | Rozumiem ograniczenia | Komunikat o materiale log; ostrzeżenie przy degeneratywnej referencji |

## Poza zakresem
.drx, log/RAW, tryb tylko-referencja, konta, płatności, ręczne krzywe/koła (w MVP tylko wizualizacja), zapisywanie projektów.

## Metryki
Patrz spec §9. North star: **% sesji z analizą zakończonych eksportem**.

## Decyzje
- Widgety z prototypu (krzywe, koła, HSL, LUT cube) pokazują wynik LUT read-only. Edycja → v2. (Decyzja PM, do potwierdzenia przez Gromka.)
- Analityka: rekomendacja Plausible — otwarte.
