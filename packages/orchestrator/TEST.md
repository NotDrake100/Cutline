# Cutline orchestrator acceptance

**Scalars:** `status`, `via`, `bannedForPrint`, `spend_gemini`, `hits_n`, `sourceUrl`  
**Baseline desk:** empty hunt → `failed`; happy desk + article OG → `needs_input`, `via=article_og`  
**Kill rule:** any case fail retracts source-first / no-gpt-fallback / photo cost order / pause-before-ship **for that row**.

**Bless:** minimum gate **n=6** only (S1, S8, P1, P2, D1, W1).

## Minimum gate

| ID | Case | Expect |
|----|------|--------|
| S1 | all `fetchPageOk=false` | `hits_n=0`, `status=failed` |
| S8 | repo scan | no symbol/call `gpt_fallback_headlines` |
| P1 | article image present | `via=article_og`, `bannedForPrint=false`, `spend_gemini=0` |
| P2 | stock photo path | `via=pexels` ⇒ `bannedForPrint=true` |
| D1 | default `runDeskPipeline` | `status=needs_input` (≠ `shipped`) |
| W1 | `runWedge` | `sourceUrl` is `manual://wedge` only (no publisher host) |

## Full freeze

### Hunt S1–S8
- **S1** URL-required → failed (gate)
- **S2** one live URL → `hits_n≥1`, that `sourceUrl` kept
- **S3** keyword miss → empty → failed
- **S4** empty first section still hunts the next source
- **S5** dead URL dropped
- **S6** dedupe by `sourceUrl`
- **S7** `limit` respected
- **S8** no `gpt_fallback_headlines` (gate)

### Photo P1–P5
- **P1** article_og + spend_gemini=0 (gate)
- **P2** pexels ⇒ bannedForPrint=true (gate)
- **P3** upload wins
- **P4** allowGeminiGen=false and no article/stock → `photo=null`
- **P5** gemini_gen ⇒ bannedForPrint=true

### Desk D1–D5
- **D1** default needs_input ≠ shipped (gate)
- **D2** autoApprove=true → approved
- **D3** rewrite.sourceUrl mismatch → failed
- **D4** ship.assertApproved on needs_input → throws
- **D5** ship.assertApproved on approved → ok

### Wedge W1–W3
- **W1** sourceUrl=manual://wedge only (gate)
- **W2** bannedForPrint=true always
- **W3** must not call scoutBeat
