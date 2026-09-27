# Cutline PRD

Cutline is a source-first AI desk: hunt live URLs → rewrite → approve → ship.

## Non-negotiables

| ID | Rule |
|----|------|
| N1 | No story without an opened `sourceUrl` |
| N2 | Photo order: upload → article still → stock (social) → Gemini gen |
| N3 | Generated stills: `bannedForPrint=true` |
| N4 | Ship blocked unless `status===approved` |
| N5 | Gemini only. Missing key fails clearly |
| N6 | Connect never claims publish unless the channel accepted it |
| N7 | Demo headline uses `manual://wedge` — never a fake publisher URL |

## Modes

- **Desk** — live `sourceUrl` → Gemini rewrite + pack
- **Demo** — pasted headline → `manual://wedge` (labeled)

## Env

`GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `PEXELS_API_KEY`, `CUTLINE_PUBLIC_URL`
