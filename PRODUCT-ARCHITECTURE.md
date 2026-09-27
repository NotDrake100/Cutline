# Cutline — Product

**Locked:** Your AI desk  
**Taste bar:** Ace Studio (Activity, Needs input, Connect, chat + tool log + canvas)

Cutline hunts live pages, rewrites with Gemini, stores media, and ships after you approve.

## Loop

```
HUNT (open live pages)
  → VERIFY (Browser holds the source URL)
  → REWRITE (Gemini on sourced text)
  → PHOTO / STILL
  → PACK
  → APPROVE
  → SHIP
```

No story without a live `sourceUrl`. Model text alone is not a story.

## Surfaces

Home · Activity · Wire · Library · Connect · Browser

Desks: Breaking · Business · Culture · Sports · Tech · World

## Env (server only)

`GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`

Missing key → honest error. No stub pack.
