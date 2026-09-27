# Cutline — what is real vs sketch (Critic 27 Sep 2026)

Falsifiable claim Critic attacked: packages *enforce* a source-first desk OS.  
**Verdict: claim dies.** Accepted.

| Layer | Reality |
|-------|---------|
| PRODUCT-ARCHITECTURE.md | Company intent + DCN mapping — **doc** |
| ARCHITECTURE.md | Weekend Gemini wedge — **doc** |
| packages/core, scout, photo, orchestrator | Typed DI **sketch** + rules in functions |
| apps/api/routes.ts | Route **names only** — no handlers |
| apps/web | Ace **marketing** HTML — not Activity/Needs input |
| runWedge | Hackathon toy path (manual://wedge + Gemini still) — **intentional Phase A** |
| runDeskPipeline | Correct control flow on paper; **no live fetch/TinyFish/Pexels wired** |
| needs_input | Status string only — **not** a persisted approve gate or UI |
| Pexels lane | Matches Hyd social; **not** same-event print truth |

## Surviving product rules (keep even while code is thin)
1. URL-required for desk mode (ban gpt_fallback).
2. Photo cost order: upload → article → Pexels(social) → Gemini(gen).
3. Ship only after explicit approve (build the gate; don’t claim it exists).
4. Cutline never on DCN droplet.

## Next code that would make Critic’s claim true
1. Real `POST /api/wedge` + `POST /api/desk` handlers with Gemini.
2. Injected TinyFish + RSS + fetchPageOk adapters.
3. Persist runs + `/api/approve` that blocks `/api/ship`.
4. Studio Activity / Needs input UI — or stop saying Ace surfaces exist.

## Methods (27 Sep 2026)
- Blessed: minimum gate n=6 in `packages/orchestrator/TEST.md` (S1,S8,P1,P2,D1,W1).
- Full 21 cases frozen for Hands test runner — not a pass.
- Do not invent unnamed product n (TinyFish threshold, null-photo copy, dedup floor).

## Hands verify (27 Sep 2026)
- Layout PARTIAL — not OK for Phase A wedge ship until HTTP `/api/wedge` + Gemini + `/studio`.
- Methods gate n=6 PASS on mocks (`runAcceptance.ts --gate`). Full 21 mock-green ≠ product pass.
- Applied proposed stubs: wireFromHeadline, stillFromBrief, packCaptions, handleWedge, ship.assertApproved+buildSharePack.
- Still missing: package.json, Gemini adapter, HTTP server, `/studio`, runs persistence.
