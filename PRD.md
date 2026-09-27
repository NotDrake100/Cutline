# Cutline PRD — coding architecture (from Critic)

**Date:** 27 Sep 2026  
**Source:** Critic kill list + Methods minimum gate + DCN VM Closer inventory  
**Status:** Build against this. Do not claim “desk OS” until Must-haves pass.

Critic’s falsifiable claim (killed):  
> Packages under `/workspace/cutline` *enforce* URL-required scout, photo order article→Pexels→gen, and needs_input before ship.

**Verdict we accept:** today = DI sketch + paste-headline wedge. This PRD defines what must exist before that claim is true.

---

## 1. Product one-liner

Cutline is a **source-first newsroom OS**: hunt live URLs → rewrite like a journalist → cheap real photos → human approve → ship to IG/YT/Canva.  
Hackathon **wedge** (paste headline → Gemini still) is Phase A only and must stay labeled as such.

---

## 2. Non-negotiables (kill the build if violated)

| ID | Rule | Why Critic / DCN |
|----|------|------------------|
| N1 | Desk mode: **no story without an opened `sourceUrl`** | Ban Hyd `gpt_fallback_headlines` |
| N2 | Photo cost order: upload → article OG → Pexels(social) → Gemini gen(last) | Hyd `auto_post` proven; don’t burn $ |
| N3 | Pexels / Gemini stills: `bannedForPrint=true` | Not same-event truth |
| N4 | **Ship blocked** unless `status===approved` | `needs_input` must be a real gate, not a string |
| N5 | Cutline **never** deployed on DCN droplet `159.223.154.151` | VM boundary |
| N6 | Lab bots (Chair/Hands/…) **not** in customer UI | Product roster only |
| N7 | Wedge must not fake publisher hostnames | `manual://wedge` OK; fake TOI URL = fail |

---

## 3. Two run modes (keep separate in code)

### Mode A — Wedge (hackathon / Phase A)
- Input: pasted headline  
- Path: Wire(from headline) → Gemini Still → Desk pack → `needs_input`  
- `sourceUrl = manual://wedge`  
- Always `bannedForPrint=true`  
- **Must not** call Scout  
- Marketing/submit may ship this; docs must say “wedge”

### Mode B — Desk (company / Phase B+)
- Input: `beatId` (hyderabad, mumbai, …)  
- Path: Scout → Wire → Sub → Photo → Desk → `needs_input` → Approve → Ship  
- URL-required end-to-end  
- TinyFish = backup when RSS/outlet hits &lt; 3 (threshold product-n TBD — don’t invent)

---

## 4. Package architecture (target, not today’s vapor)

```
cutline/
  apps/web/          # Ace marketing + /studio (Activity, Needs input, tool log)
  apps/api/          # REAL handlers (not route-name strings)
  packages/
    core/            # types, BeatConfig, StoryRun, env names
    scout/           # RSS + TinyFish + fetchPageOk
    wire/            # Gemini Flash brief from page text
    sub/             # house-voice rewrite; sourceUrl immutable
    photo/           # resolvePhoto cost order
    still/           # Gemini image — wedge or allowGeminiGen
    clip/            # optional
    desk/            # captions / pack
    ship/            # assertApproved + channel adapters
    night/           # QA rules before approve prompt
    orchestrator/    # runWedge | runDeskPipeline
    adapters/        # rss, tinyfish, pexels, gemini, http fetch
```

**Critic gap today:** only `core`, `scout`, `photo`, `orchestrator` have logic; `apps/api` is names only; web is marketing.

---

## 5. API contract (must implement)

| Method | Body | Behavior |
|--------|------|----------|
| `POST /api/wedge` | `{ headline }` | `runWedge`; persist run; return runId + pack preview |
| `POST /api/desk` | `{ beatId }` | `runDeskPipeline`; persist; status `needs_input` or `failed` |
| `POST /api/approve` | `{ runId, edits? }` | only from `needs_input` → `approved` |
| `POST /api/ship` | `{ runId, channel }` | **reject** unless `approved`; then ig\|yt\|canva\|zip |
| `GET /api/runs/:id` | — | full run + agent log + spend |

Persistence required (disk or DB). In-memory-only = Critic kill #7 still stands.

---

## 6. Data contracts (freeze)

```ts
SourceHit { title, sourceUrl, outlet, via: rss|tinyfish|outlet_fetch|manual }
WireBrief { headline, angle, cityLead, visualPrompt, facts[], sourceUrl }
Rewrite   { headline, body, caption?, houseStyle, sourceUrl } // sourceUrl immutable
PhotoAsset{ pathOrUrl, credit, md5, via, bannedForPrint }
Pack      { igCaption, ytTitle, ytDescription, stillUrl?, clipUrl? }
StoryRun  { id, beat, status, hits[], brief?, rewrite?, photo?, pack?, log[], spendCents }
status    = hunting|drafting|needs_input|approved|shipped|failed
```

---

## 7. Photo lane (coding spec)

```
if upload → via=upload, bannedForPrint=false
else if article image from sourceUrl → via=article_og, bannedForPrint=false
else if Pexels(query) → via=pexels, bannedForPrint=true
else if allowGeminiGen → via=gemini_gen, bannedForPrint=true
else photo=null
```

Print / truth UI must hide or label `bannedForPrint` assets.  
Same-event search (multi-outlet) is a **later** Photo enhancement — do not claim it equals current Pexels.

---

## 8. Scout lane (coding spec)

1. Load beat (`rssFeeds` + `keywords`) — Hyd = **7 live feeds** from bot `RSS_FEEDS` (not full `sources.yaml` Telugu until wired).  
2. Fetch RSS → keyword filter → `fetchPageOk(link)` or drop.  
3. If `hits.length < 3` and TinyFish configured → search `domain_type=news` → same URL check.  
4. Dedupe by `sourceUrl`. Cap `limit`.  
5. **Never** call `gpt_fallback_headlines`.

TinyFish: `GET https://api.search.tinyfish.ai?query=&domain_type=news&location=IN&recency_minutes=2880`

---

## 9. UI surfaces (Ace-grade — required for “not a toy”)

Minimum before claiming Ace product UI:

| Surface | Must show |
|---------|-----------|
| Studio | Roster · chat · canvas · **tool log** (agent timeline) |
| Needs input | Approve / edit / skip on rewrite + still |
| Activity | Runs waiting + what moved |
| Connect | IG / YT / Canva cards (demo mode OK for hackathon) |

Marketing `index.html` alone ≠ product.

---

## 10. Acceptance gate (Methods — blessed n=6)

Ship no “source-first OS” claim until these pass in CI:

1. **S1** all pages dead → `failed`  
2. **S8** no `gpt_fallback_headlines` in repo  
3. **P1** article present → `via=article_og`, `spend_gemini=0`  
4. **P2** pexels → `bannedForPrint=true`  
5. **D1** desk default → `needs_input` ≠ `shipped`  
6. **W1** wedge → `sourceUrl=manual://wedge` only  

Plus **D4**: `ship` on `needs_input` throws / HTTP 409.

Full 21 cases: `/workspace/cutline/packages/orchestrator/TEST.md` (freeze for Hands runner).

---

## 11. Critic kill → PRD requirement map

| Critic # | Kill | PRD requirement to clear |
|----------|------|---------------------------|
| 1 | Wedge is the only ship path / toy | Separate Mode A vs B; submit labels wedge; desk API live for B |
| 2 | Dual docs contradict | ARCHITECTURE.md = wedge; PRODUCT = company; STATUS.md honesty |
| 3 | API names only | Implement §5 handlers |
| 4 | Roster types only | Implement wire/sub/desk/still/ship packages + adapters |
| 5 | Scout unwired | Adapters for RSS + TinyFish + fetchPageOk; fill Mumbai feeds later |
| 6 | Pexels ≠ same-event | Don’t market Pexels as truth; add same-event search as Phase C |
| 7 | needs_input not a gate | Persist runs + approve + ship.assertApproved |
| 8 | TEST vs wedge URL | W1 allows manual://wedge only |
| 9 | BeatConfig import | Fixed in core — keep typecheck green |
| 10 | Ace surfaces prose | Build Studio Needs input / Activity or stop claiming |

---

## 12. Phased delivery

| Phase | Deliverable | Done when |
|-------|-------------|-----------|
| **A — Hackathon** | `/api/wedge` + Ace marketing + studio eye-view + Gemini still/pack | Cold open works twice; submit pack |
| **B — Desk OS** | Scout adapters + `/api/desk` + persist + approve + ship block | Methods n=6 + D4 green |
| **C — Truth media** | Same-event photo search before Pexels; multi-city beats | Photo P-same-event cases added |
| **D — Connect** | Real IG/YT/Canva OAuth | One channel ships for real |

---

## 13. Env (Cutline host — not droplet)

`GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `TINYFISH_API_KEY`, `PEXELS_API_KEY`, `CUTLINE_PUBLIC_URL`

---

## 14. Out of scope

- Deploying on DCN VM  
- Pasting SSH keys in chat  
- Inventing news without URL  
- Purple AI-slop UI  
- Claiming VC-ready desk OS before §10 gate

---

*Companion files:* `STATUS.md` (honest now), `PRODUCT-ARCHITECTURE.md` (company), `ARCHITECTURE.md` (wedge), `packages/orchestrator/TEST.md` (21 cases).
