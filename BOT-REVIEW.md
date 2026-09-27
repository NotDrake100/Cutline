# Bot review assignments — Cutline architecture (27 Sep 2026)

## Do not
- Deploy or write Cutline onto `root@159.223.154.151`
- Paste or request VM private keys in chat
- Invent news without `sourceUrl`

## Files to review
- `/workspace/cutline/PRODUCT-ARCHITECTURE.md`
- `/workspace/cutline/ARCHITECTURE.md` (weekend wedge)
- `/workspace/cutline/packages/**` (contracts + pipeline code)
- `/workspace/cutline/apps/web/index.html` (Ace front)

## Assignments
| Bot | Job | Done when |
|-----|-----|-----------|
| Hands | Verify package layout; propose missing modules; scaffold only under `/workspace/cutline` | Checklist of gaps + optional PR-ready patch list |
| Critic | Kill anything toy / hallucinated / cost-wasteful | One falsifiable kill list (≤10 bullets) |
| Methods | Acceptance tests: URL-required, photo cost order, needs_input gate | Written test cases in `packages/orchestrator/TEST.md` |
| DCN VM Closer | Diff this architecture vs live `/root/dcn` + TinyFish paths | Confirm or correct any wrong claim |
| Record | Log architecture lock + bot findings in lab notebook | Dated entry |
