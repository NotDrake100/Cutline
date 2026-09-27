# Cutline orchestrator acceptance (Methods — 27 Sep 2026)

**Honest baseline (Critic):** packages are a DI sketch until adapters + API + approve gate ship.

**Scalars:** `status`, `via`, `bannedForPrint`, `spend_gemini`, `hits_n`, `sourceUrl`  
**Baseline desk:** empty scout → `failed`; happy desk + article OG → `needs_input`, `via=article_og`, `bannedForPrint=false`, `spend_gemini=0`  
**Kill rule:** any case fail retracts source-first / no-gpt-fallback / photo cost order / pause-before-ship **for that row**.

**Bless:** minimum gate **n=6** only (S1, S8, P1, P2, D1, W1).  
**Full sheet (21)** = freeze for Hands test runner — **not** a pass label yet.

---

## Minimum gate (blessed)

| ID | Case | Expect |
|----|------|--------|
| S1 | all `fetchPageOk=false` | `hits_n=0`, `status=failed` |
| S8 | repo scan | no symbol/call `gpt_fallback_headlines` |
| P1 | article image present | `via=article_og`, `bannedForPrint=false`, `spend_gemini=0` |
| P2 | Pexels path | `via=pexels` ⇒ `bannedForPrint=true` |
| D1 | default `runDeskPipeline` | `status=needs_input` (≠ `shipped`) |
| W1 | `runWedge` | `sourceUrl` is `manual://wedge` only (no publisher host) |

---

## Full freeze (21) — Hands runner, not pass

### Scout S1–S8
- **S1** URL-required → failed (gate)
- **S2** one live URL → `hits_n≥1`, that `sourceUrl` kept
- **S3** keyword miss all feeds → empty → failed
- **S4** TinyFish backup only when `hits_n<3` and tinyfish wired (threshold product-n **unnamed** — do not invent)
- **S5** TinyFish hit without `fetchPageOk` → dropped
- **S6** dedupe by `sourceUrl`
- **S7** `limit` respected
- **S8** no `gpt_fallback_headlines` (gate)

### Photo P1–P5
- **P1** article_og + spend_gemini=0 (gate)
- **P2** pexels ⇒ bannedForPrint=true (gate)
- **P3** upload wins over article/pexels
- **P4** allowGeminiGen=false and no article/pexels → `photo=null` (product baseline copy **missing** — do not invent)
- **P5** gemini_gen ⇒ bannedForPrint=true, spend_gemini>0

### Desk D1–D5
- **D1** default needs_input ≠ shipped (gate)
- **D2** autoApprove=true → approved (still not shipped)
- **D3** rewrite.sourceUrl mismatch → failed
- **D4** ship.assertApproved on needs_input → throws
- **D5** ship.assertApproved on approved → ok

### Wedge W1–W3
- **W1** sourceUrl=manual://wedge only (gate)
- **W2** bannedForPrint=true always
- **W3** must not call scoutBeat

---

## Missing n/baseline (do not invent)
- TinyFish backup threshold (`hits.length < 3`) unnamed as product n
- No spend budget table per beat (1¢ wire/sub/desk, 5¢ gemini are code facts only)
- Null-photo copy when `allowGeminiGen=false`
- Multi-feed dedup stress floor unnamed
