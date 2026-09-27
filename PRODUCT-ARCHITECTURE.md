# Cutline — Product Architecture (not the toy)

**Locked:** Sun 27 Sep 2026 IST  
**Taste bar:** Ace Studio (Marketer-class product UI: Activity, Needs input, Connect, chat + tool log + canvas)  
**Industry truth:** Daily City News desk you already run (Pune / Mumbai Hermes / Hyderabad social)  
**Hackathon wedge:** still ships as a thin Gemini path inside this same OS — not a separate toy product

> VM rule unchanged: never deploy Cutline onto `root@159.223.154.151`. DCN Hyderabad lives at `/root/dcn` (telegram_bot, auto_post, reel_post, dashboard, ig_auth). DCN Mumbai at `/root/dcn-mumbai`. Cutline gets its own Cloud Run / Vercel tree.

---

## 0. What we have already done (facts)

| Piece | Status | Where |
|-------|--------|--------|
| Desk Check (Gemini prereq) | Live | `https://desk-check.ai.studio` |
| Cutline marketing front (Ace lime / Anton / square) | Local preview | `/workspace/cutline/apps/web/index.html` |
| Weekend thin architecture | Written | `/workspace/cutline/ARCHITECTURE.md` |
| Familiar-style studio shell concept | Researched | `/workspace/familiar/` |
| Crane brand mark | Generated | `/workspace/crane-brand/` |
| DCN Mumbai automated close | Proven on VM | hunt → verify-rewrite → photo-credits → layout → QA → Telegram |
| TinyFish news Search | Key on VM | `/root/dcn-mumbai` · `bin/tinyfish_search.py` · `domain_type=news` |
| Photo discipline | Locked skill | published-story / same-event stills only; crop-to-fill `#22C55E`; no AI event fakes |
| Hyderabad social stack | Live, do not touch from Mumbai job | `/root/dcn` Telegram + IG + reels + dashboard |
| Ace / Rico taste study | Done | refs under `/workspace/cutline/assets/refs/ace-*.png` |

Hackathon deadline still needs: public Cutline URL with real Gemini studio, one-pager, Playcast ≤60s, ~2 min video, submit pack. That is the **wedge**. This document is the **company**.

---

## 1. One-sentence product

**Cutline is a newsroom operating system:** it hunts the wire end-to-end, types like a journalist, fills pictures without burning model money, runs a desk of specialist agents, and ships to Instagram / YouTube / Canva / print — with human approve gates so it is not a chatbot toy.

That is what Ace’s Marketer product shows in product form (Activity · Needs input · What’s changed · Connect · chat + tool log). Cutline is the same class of surface, for news.

---

## 2. Industry loop (what DCN already taught us)

Real newspaper mechanics, not “AI writes a post”:

```
HUNT (sources + search APIs)
  → VERIFY (open live URL; drop unsourced model text)
  → REWRITE (house voice; named officials; city lead)
  → PHOTO (story-page still first; credit; unique md5)
  → LAYOUT / PACK (slots, crop-to-fill, platform sizes)
  → APPROVE (Needs input)
  → SHIP (Telegram paper / IG / YT / Canva / zip)
```

### Proven pieces from your stack

1. **Hunt** — City outlet lists + live page fetch (Firecrawl/Tavily/HTTP). TinyFish free Search (`domain_type=news`, recency/location) as backup when outlet scrape is thin. Every brief **must** have a live URL you opened. Model text alone is not a story.
2. **Journalist typing** — Verify then rewrite in house voice (`DCN News Network`, `City:` lead, sentence-case heads). OpenAI/gpt-5-mini on Mumbai VM; Gemini on Cutline for the hackathon path. Never paste source grafs; never invent quotes.
3. **Photos without wasting money** — Prefer the still already on the published story page (free bandwidth). Crop-to-fill. Credit outlet. Never reuse md5 in one edition. **Do not** spend Imagen/Gemini image dollars for event photos when a real still exists. AI-generated event photos are banned for print truth.
4. **Second image path** — When the story page has no usable still: (a) same-event search across other outlets / image search API, then (b) only for **social still / illustration** products, Gemini image. Print and “truth” lanes stay photo-first.
5. **Hyderabad social** — Separate ship lane: `auto_post.py`, `reel_post.py`, Telegram, Instagram, dashboard. Cutline’s Ship agent is the productized version of that lane (IG / YT / Canva Connect), not a rewrite of `/root/dcn`.
6. **Layout / chrome** — Slot templates, green wells, packed pages. Cutline’s canvas is the digital twin: Still · Clip · Pack · (later) Page.

**Global expansion:** same loop, swap beat + source list (city → nation → vertical). Hunt config is data, not a new product.

---

## 3. Product surfaces (Ace-grade — not a single chat toy)

Mirror the Marketer-class IA you screenshotted from Ace, mapped to news:

| Surface | Job | DCN analog |
|---------|-----|------------|
| **Home / Ask** | “What’s moving on my beat?” natural language | Desk chat |
| **Activity** | What needs you + what moved | Night Editor + QA |
| **Needs input** | Approve rewrite, pick still, hold/push ship | Human close |
| **What’s changed** | Wire alerts: new URLs, ROAS-style for news = spike in coverage, photo missing, deadline risk | Hunt delta |
| **Hunt** | Source list, TinyFish queries, live URL queue | `dcn-*-hunt` |
| **Copy** | Verified rewrites, house style | `dcn-verify-rewrite` |
| **Photo** | Credits, uniqueness, crop wells | `dcn-photo-credits` |
| **Studio** | Roster · chat · canvas (Familiar grid) | Art + Sub + Night |
| **Connect** | Instagram, YouTube, Canva, (later) Telegram / print | Hyderabad ship + plugins |
| **Runs** | Every pipeline artifact: brief.json, still, pack | `runs/{id}/` |

UI rules (Ace): black canvas, lime `#E1F435` signal only, square corners, Anton display + mono metadata, flat CTAs, tool log visible (like Ace’s Campaign manager “Working for 1m 20s”).

---

## 4. Agent roster (product, not lab)

Lab agents (Chair, Hands, Critic…) stay **out** of the product UI.

| Agent | Does | Cheap path | Expensive path (only if needed) |
|-------|------|------------|----------------------------------|
| **Scout** | Hunt URLs via outlet list + TinyFish news | HTTP + TinyFish | — |
| **Wire** | Normalize angle + visual brief from verified page | Gemini Flash / text | — |
| **Sub** | House-voice rewrite; fact check vs URL | Gemini Flash | Human edit in Needs input |
| **Photo** | Pull story still; crop; credit; uniqueness | Download + Pillow | Image search API |
| **Still** | Social/editorial frame when no photo or for illustrated card | — | Gemini image |
| **Clip** | Short motion | Gemini video / still animate | Higgsfield polish only for marketing |
| **Desk** | Captions + platform pack | Gemini Flash | — |
| **Ship** | Export / Connect post | Local + OAuth | — |
| **Night** | QA gates before ship | Rules engine | — |

Orchestrator is dumb and ordered (same as DCN desk skill), with **pause points** for Needs input.

---

## 5. Cost architecture (why VCs care)

Newsrooms die on API burn. Cutline’s default is **print economics**:

| Step | Default cost | Ban |
|------|--------------|-----|
| Discovery | TinyFish free tier / outlet fetch | Paid search models on every close |
| Body | Flash-class rewrite on fetched text | Generating “news” with no URL |
| Photo | Story-page download | Imagen for every event still |
| Social still | Gemini image **only** when Photo lane empty or user asks illustrated | Always-on image gen |
| Ship | Bandwidth + OAuth | Auto-post without approve |

Metering UI (Ace “What’s changed” style): show $ / run and which lane spent tokens. That is a product feature, not an afterthought.

---

## 6. Data model (minimal durable)

```
org
  beat[]          # city / vertical / language
  sources[]       # outlet URLs + TinyFish query templates
  house_style     # lead prefix, byline, bans
  connections[]   # IG / YT / Canva / Telegram

story
  urls[]          # verified live sources
  facts[]         # extracted, attributed
  rewrite         # house-voice body
  photo[]         # url, credit, md5, crop box
  pack            # ig / yt / canva / print slots
  status          # hunting | drafting | needs_input | approved | shipped

run
  agent_log[]     # Ace-style tool timeline
  spend           # tokens / image calls / cents
```

---

## 7. Build phases

### Phase A — Hackathon wedge (this weekend)
- `/` Ace marketing · `/studio` Wire→Still→Desk→Ship on **pasted headline**
- Gemini only; canned demos; Connect cards (demo mode OK)
- Prove the eye-view and Gemini requirement
- **Do not** claim full Hunt on the submit URL unless it works cold

### Phase B — Real desk (post-submit / VC story)
- Scout + TinyFish + outlet fetch
- Sub rewrite with URL verify
- Photo lane before Still spend
- Activity / Needs input / What’s changed
- Connect OAuth for one channel for real

### Phase C — Multi-city / network
- Beat packs (Pune, Mumbai, Hyderabad, then global English desks)
- Print PDF export (reuse DCN layout lessons, not the VM)
- Hyderabad-class social automation as Ship plugins

---

## 8. VC narrative (one page)

**Problem:** Small and mid newsrooms cannot staff 24/7 hunt + rewrite + photo + multi-platform ship. “AI news” tools either hallucinate without sources or burn money generating images and copy nobody trusts.

**Solution:** Cutline is a desk OS with source-first hunt, journalist rewrite, photo-first cheap media, and Ace-grade approve gates — built by someone who already ships a daily paper (DCN) and social news stack (Hyderabad).

**Why now:** Agent UIs are becoming real products (Ace/Marketer class). Gemini + cheap news search (TinyFish) make the economics work. Distribution (IG/YT/Canva) is API-shaped.

**Wedge:** Headline → verified pack in under a minute for solo publishers. Expand to full hunt+close for city desks who already pay people to do this by hand.

**Moat:** House-style + beat source graphs + photo uniqueness + approve workflow learned from running a real paper — not a wrapper around a chat model.

**Ask use of capital:** Productize Hunt/Photo/Needs-input, one city desk design partner, Connect OAuth, not more model experiments.

---

## 9. Explicit non-goals

- Not a chatbot that invents news
- Not “generate every photo with AI”
- Not deploying on the DCN droplet
- Not putting Chair/Hands/lab politics in the customer UI
- Not purple AI-slop chrome

---

## 10. Immediate next build choice

For the hackathon: keep Phase A wedge.  
For the company pitch: this document is the architecture. Studio UI should grow toward **Activity + Needs input + tool log**, not more marketing sections.

---

## 11. VM inventory (authoritative — 27 Sep 2026)

Read-only from droplet `159.223.154.151` via DCN VM Closer. Nothing changed on the VM.

### Split
| Stack | Path | Role |
|-------|------|------|
| Hyderabad social | `/root/dcn` · `dcn-bot.service` → `telegram_bot.py` | Telegram approve → Instagram + reels + carousel + dashboard |
| Mumbai print | `/root/dcn-mumbai` | Hunt → rewrite → photo → PDF → Telegram paper |
| TinyFish | **Mumbai only** (`bin/tinyfish_search.py`) | Not under `/root/dcn` |
| Cutline | **Never on this VM** | Own Cloud Run / Vercel tree |

Hyderabad `.env.template` keys: `OPENAI_API_KEY`, `PEXELS_API_KEY`, `TELEGRAM_*`, `IG_TOKEN`, `IG_USER_ID`, `VPS_URL`.

### Hyderabad end-to-end (proven)
1. **Hunt (RSS, not TinyFish)** — `sources.yaml` tiers + hardcoded `RSS_FEEDS` in `telegram_bot.py` (Siasat, Telangana Today, Hans India, Deccan Chronicle, Hyderabad Mail, Great Telangana, Telangana Tribune). Filter by city KEYWORDS. Keep `entry.link` as `source_url`. Dedupe; top 3. If RSS < 3: `gpt_fallback_headlines()` via gpt-4o (**weaker** — Cutline must not copy this; keep Mumbai URL-required rule).
2. **Journalist typing** — `generate_stories()` / `generate_post_fields_from_text()` / carousel `generate_content()` → JSON (`headline`, `body`, `query`, `caption`, `source_url`). Human gate in Telegram: pick 1/2/3 → preview → approve / skip / edit.
3. **Compose + ship** — `auto_post.py` green-chroma templates, cover-crop, draw type, `/root/dcn/posts/…png`, Telegram preview → IG Graph + `VPS_URL`. Also `reel_post.py`, `carousel_post.py`, `compose_post.py`, `video_search.py` (YT / Reddit r/hyderabad / X via Nitter + yt-dlp), `dashboard.py`, `ig_auth.py`. Pending: `pending_approval.json`, `pending_stories.json`, `pending_city_reel.json`.

### Photo priority (`auto_post.py`)
1. Local `--input-image` (Telegram upload)
2. `--source-url` → `fetch_article_image.py` (OG / Twitter / schema / article img; reject text-banner overlays)
3. Else **Pexels** `api.pexels.com/v1/search` (portrait); fallback query `india city news`; else dark fill

**No TinyFish and no second paid image API inside `/root/dcn`.** Second image path = **Pexels**.

### TinyFish (Mumbai → Cutline Scout)
- `GET https://api.search.tinyfish.ai?query=…&domain_type=news&location=IN&recency_minutes=2880`
- Key: `TINYFISH_API_KEY` in Mumbai `.env` / `secrets/tinyfish_api_key`
- Role: backup when outlet/RSS hunt is thin. Wire into Cutline Scout, not into Hyderabad bot.

### Agent map (proven → product)
| Cutline | Analog |
|---------|--------|
| Scout | Hyd RSS + `sources.yaml`; Mum TinyFish |
| Wire / Sub | Hyd `generate_stories` (gpt-4o); Mum verify-rewrite |
| Photo | Article OG first → Pexels (social); Mum published-story + still_guard (print) |
| Still (gen) | Not on Hyd path; ban for print truth |
| Ship | Telegram approve → IG / reel / carousel |

### Honest gaps to close in Cutline
- Ban gpt-only headlines when RSS is thin — URL required like Mumbai print.
- Pexels OK for social cards; print/truth stays story-page still first.
- TinyFish = cheap Scout search; keep off `/root/dcn`.

### Closer second-pass (27 Sep 2026)
- Live hunt = 7-feed `RSS_FEEDS` only; `sources.yaml` Telugu tier3 not wired into bot loop.
- `beats.ts` patched to match live 7 URLs + expanded keywords.
