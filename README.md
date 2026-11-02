# Cutline

A news desk in the browser: find a sourced story, rewrite it into a post, approve it, then export.

**Live demo:** https://cutline.dev

## What it does

- **Hunt:** opens public news section pages and keeps only stories that have a live source URL.
- **Browser:** shows the original source page next to the draft, so every post can be checked against where it came from.
- **Rewrite and edit:** drafts a headline and caption from the source text with Google Gemini, in one of four styles (tight news, social caption, long lede, neutral brief). You can edit everything before it goes anywhere.
- **Analyze a post:** paste an Instagram, X or YouTube link to preview it and draft a new post in the same style.
- **Approve, then ship:** nothing is exported until you approve it. Approved posts go to Canva or download as a ZIP. Stills, clips and captions are kept in a local library.

The public demo runs on sample data and cached pages, so it does not call any paid APIs.

Cutline is a hackathon project, inspired by the workflow of a local news desk (Daily City News, Pune).

## Stack

- Node.js 20+ and TypeScript (run with `tsx`)
- Plain HTML, CSS and JavaScript front end
- SQLite (`better-sqlite3`) for the library
- Google Gemini API for rewrites
- Canva Connect API for export
- Hosted on Vercel

## Run locally

You need Node.js 20 or newer.

```
git clone https://github.com/NotDrake100/Cutline.git
cd Cutline
npm install
cp .env.example .env
```

Open `.env` and fill in your own keys. A Gemini API key is enough to try rewrites. The other keys are only needed for the integrations you want to use.

```
npm run dev
```

Then open http://127.0.0.1:8787/ for the landing page and http://127.0.0.1:8787/studio.html for the desk.
