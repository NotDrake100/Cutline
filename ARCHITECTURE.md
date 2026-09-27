> **Scope:** weekend Gemini **wedge** only (paste headline). Full desk OS = PRODUCT-ARCHITECTURE.md + packages sketch. See STATUS.md (Critic 27 Sep 2026).

# Cutline — perfect weekend architecture (copy this)

**Product:** News desk tool. Paste headline → specialist agents → still + clip + share pack.  
**UI shell:** Fork `/workspace/familiar/` (Muse + Grok Bot layout). Rebrand to Cutline.  
**Engine:** Google Gemini (hackathon rule). Higgsfield = marketing Video C polish only.  
**Access:** Free Try it now. No Stripe this weekend.

> VM note: `root@159.223.154.151` was not reachable from this box (SSH key denied).  
> Reuse the **DCN Hermes pattern** you already know: skills beside the stack, secrets only in `.env`, never in skill files. Put Cutline in a **new tree** on the VM (e.g. `/root/cutline`), do not touch DCN systemd/Telegram bots.

---

## 1. Surfaces (what to build)

| Route | Job |
|-------|-----|
| `/` | Marketing: hero, Try it now, 3 sample stills, Built with Gemini, YouTube embed |
| `/studio` | Familiar shell: left roster · center chat · right canvas |
| `/demos` | Optional: 3 canned chips that deep-link into `/studio?demo=…` |
| `/api/*` | Thin Next/Express or Cloud Run functions |

Cold-open must work twice with empty cache.

---

## 2. UI layout (Familiar → Cutline)

Copy grid from Familiar: `280px | 1fr | 340px`.

**Left — Expert desk (assign these 5 only)**

| Agent | One-line job | Model / tool | Canvas output |
|-------|--------------|--------------|---------------|
| **Wire** | Normalize headline + angle + visual brief | `gemini-2.0-flash` text | Brief card in chat |
| **Still** | Generate news still from Wire brief | Gemini image (Imagen / Gemini image API) | Frame on canvas |
| **Clip** | 3–8s motion from still (or Gemini video if unlocked) | Gemini first; Higgsfield only if labeled “polish” | Clip scrubber |
| **Desk** | Caption, cutline text, platform sizes | `gemini-2.0-flash` | Caption pack |
| **Ship** | Export zip / copy share text / open YT title | Local JS only this weekend | Share pack card |

Status dots: idle / running / done (green). One active agent highlighted.

**Center — Chat**  
User pastes headline or taps canned chip. Agents post as bubbles with name tags. Orchestrator auto-runs Wire → Still → Clip → Desk (Ship waits for click).

**Right — Computer / canvas**  
Tabs: Still · Clip · Pack. Shows latest assets. Big “Built with Google Gemini” chip.

**Theme:** Familiar dark (`#070708`) + Cutline alert accent (yellow `#f5c518` or siren red) instead of Familiar ember orange if you want news energy. Keep wordmark **CUTLINE**.

---

## 3. Layer stack (copy DCN “beside the stack” idea)

```
cutline/
  apps/web/          # Familiar fork (static or Next)
  apps/api/          # Cloud Run: /generate/still, /generate/clip, /brief
  packages/agents/   # Wire Still Clip Desk Ship prompts + schemas
  packages/orchestrator/  # runPipeline(headline) → ordered agent calls
  .env               # secrets — never commit (same rule as DCN Hermes)
  CUTLINE-HACK.md    # diary + URLs + submit checklist
```

**Layers (data flow)**

1. **Ingress** — headline string or `demoId`  
2. **Wire layer** — JSON brief `{headline, angle, visual_prompt, style}`  
3. **Still layer** — image bytes/URL + prompt used  
4. **Clip layer** — short mp4/webm or animated still  
5. **Desk layer** — `{cutline, yt_title, ig_caption}`  
6. **Ship layer** — pack URLs for UI (no real IG post required)

Persist run folder: `runs/{id}/brief.json`, `still.png`, `clip.mp4`, `pack.json`.

---

## 4. Keys / env (on VM or Cloud Run — names only)

```
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=   # whatever AI Studio shows for image
GEMINI_TEXT_MODEL=gemini-2.0-flash
# optional later:
# HIGGSFIELD_API_KEY=   # marketing pipeline only, not /studio submit path
CUTLINE_PUBLIC_URL=https://cutline.ai
```

Same discipline as DCN: `.env` on the machine, never in markdown skills, never logged.

---

## 5. Orchestrator (solo weekend — keep dumb)

```
on Try it now / Send:
  run = createRun(headline)
  brief = Wire.run(headline)          # show in chat
  still = Still.run(brief)           # canvas
  clip  = Clip.run(still, brief)     # canvas (skip OK if time)
  pack  = Desk.run(brief, still)     # chat + pack tab
  await user Ship.click()            # optional
```

No multi-agent debate. No memory DB. In-memory + disk `runs/`.

---

## 6. Canned demos (hardcode 3)

1. Pune rains / city civic  
2. Markets / RBI-style  
3. Cricket / sports night  

Each chip sets `visual_prompt` override so Still never blanks.

---

## 7. Deploy for submit

- Frontend: Vercel or static on Cloud Run  
- API: Cloud Run + AI Studio key  
- Domain → HTTPS  
- One-pager PDF + Playcast 1-min = **screen of this URL**  
- Video C = Higgsfield polish around that screen capture  

---

## 8. Expert team mapping (your Grok Bot lab → Cutline agents)

You already run specialist bots (Chair, Hands, Editor…). For the **product UI**, do not embed those. Map the *idea* only:

| Lab role vibe | Cutline agent |
|---------------|---------------|
| Reporter / hunt | Wire |
| Art / photo | Still |
| Motion / video stack | Clip |
| Sub-editor | Desk |
| Night editor / close | Ship |

Judges see a newsroom OS, not your internal Grok Bot roster.

---

## 9. Saturday 2 PM build order (architecture → pixels)

1. Copy Familiar → `cutline/apps/web`, rename brand + 5 agents  
2. Landing with Try it now → `/studio`  
3. Wire + Still API with Gemini (real)  
4. Canvas shows still  
5. Desk captions  
6. Clip if time  
7. Deploy + domain  
8. Then videos  


---

## 10. What is actually on the VM (159.223.154.151) — inspected

**Do not break:** `/root/dcn` (Hyderabad news/video/IG + `dcn-bot.service`), `/root/dcn-mumbai` (Mumbai paper + telegram), Hermes gateway.

**Expert Hermes skills already on the box (newsroom org chart):**
- dcn-editor, dcn-chief-reporter, dcn-chief-sub-editor
- dcn-art-director, dcn-photo-editor, dcn-night-editor, dcn-production-editor
- dcn-qa-close, dcn-telegram-paper
- dcn-mumbai pipeline: vm-boundary → hunt → verify-rewrite → photo-credits → layout → qa-close → telegram-paper

**Env key names present (values never copied here):**
- `/root/dcn/.env`: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_BOT_TOKEN, TELEGRAM_LOCAL_API
- `/root/dcn/.env.template` also documents: OPENAI_API_KEY, PEXELS_API_KEY, IG_TOKEN, IG_USER_ID, VPS_URL
- `/root/dcn-mumbai/.env`: TELEGRAM_DCN_BOT_TOKEN, TELEGRAM_DCN_CHAT_ID, DCN_MUMBAI_ROOT, OPENAI_MODEL, TINYFISH_API_KEY
- `/root/.hermes/.env`: OPENAI_API_KEY, TELEGRAM_*, browser/vision tool flags
- **No GEMINI_API_KEY on the VM yet** — add for Cutline only in `/root/cutline/.env`

**Cutline placement on this VM:**
```
/root/cutline/           # NEW tree — never import DCN telegram bots
  apps/web/              # Familiar fork
  apps/api/
  .env                   # GEMINI_API_KEY=... only
  runs/
```

**Map Hermes desk → Cutline UI agents:**
| Hermes skill vibe | Cutline agent |
|---|---|
| chief-reporter / hunt | Wire |
| photo-editor / art-director | Still |
| (new) motion | Clip |
| chief-sub-editor | Desk |
| night-editor / telegram-paper | Ship |

