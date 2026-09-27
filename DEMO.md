# Cutline — 60 seconds (public showcase)

Landing **Open the desk** → `/studio?demo=1`. Public traffic is Demo: fixtures + cached city pages. Gemini is never billed.

## Kill path

1. **Paste a post URL** — Instagram / X / YouTube (or DCN chips). **DCN · Instagram** uses `https://www.instagram.com/p/DdwHjcpId9B/` (query like `?stkn=` is stripped). Analyze uses OG / oEmbed / fixtures — no Gemini. Browser switches to that URL and loads the Instagram/X/YouTube **embed** (`/embed/captioned` for IG) so the real post shows in-panel. If the site blocks the iframe, chrome still shows the live URL + Open + a note. Post preview keeps the **full caption** (not truncated). Then ask **make the same type of post** — demo builds a **new** city story in that style (fixtures, no Gemini), not a clone of the pasted caption.
2. **Find news** — Home city recs (Pune / Mumbai) or Explore. Pick a story.
3. **Browser** — The pane holds the live source URL (cached city / DCN page in Demo).
4. **Edit text** — Magic Layer fills the post. Edit headline / caption.
5. **Photo** — Magic Layer **Photo** (or click the still) cycles credit-safe stills: baked DCN card → Pexels/source still → alt. Demo never calls Gemini image gen.
6. **Approve** — human gate. Then **Canva** or ZIP.

## DCN Hyderabad template (style-copy only)

**Copy this style** (button next to Analyze, or paste URL + ask “copy this style”) layers the real Hyd DCN chrome (`template_post_chrome_hyderabad.png`: logo + footer) over a city/Pexels still with an editable on-card headline. Tips / news recommendations stay **news-photo only** (`city.jpg`) — no DCN logo overlay unless the user chooses style-copy.

Bake chrome + optional cards via `scripts/bake_dcn_cards.py` (chroma-key green `(0,122,63)` on `template_post.png`).

`?demo=1` sets `cutline_force_demo` cookie + `x-cutline-demo: 1` so the API never opens Gemini `generateContent` (also `CUTLINE_FORCE_DEMO=1`). Canva without OAuth returns **connect_required** — never a fake Published toast.

Owner desk (Settings → Owner key) is the only path that may call Gemini. See README “Demo vs owner AI”.

Optional: turn on **Vercel Deployment Protection** (a password) if the desk should stay judges-only. Public demo still never bills Gemini. Do not put the site on a DCN droplet.
