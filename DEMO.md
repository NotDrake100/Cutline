# Cutline — 60 seconds (public showcase)

Landing **Open the desk** → `/studio?demo=1`. Public traffic is Demo: fixtures + cached city pages. Gemini is never billed.

## Kill path

1. **Paste a post URL** — Instagram / X / YouTube (or DCN chips). **DCN · Instagram** uses `https://www.instagram.com/p/DdwHjcpId9B/` (query like `?stkn=` is stripped). Analyze uses OG / oEmbed / fixtures — no Gemini. Browser opens that URL.
2. **Find news** — Home city recs (Pune / Mumbai) or Explore. Pick a story.
3. **Browser** — The pane holds the live source URL (cached city / DCN page in Demo).
4. **Edit text** — Magic Layer fills the post. Edit headline / caption.
5. **Approve** — human gate. Then **Canva** or ZIP.

Owner desk (Settings → Owner key) is the only path that may call Gemini. See README “Demo vs owner AI”.

Optional: turn on **Vercel Deployment Protection** (a password) if the desk should stay judges-only. Public demo still never bills Gemini. Do not put the site on a DCN droplet.
