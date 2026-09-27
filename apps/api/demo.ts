/**
 * Non-billable Demo fixtures. Public traffic uses these so Hunt → Browser →
 * Magic Layer → Approve → Canva works without Gemini generateContent.
 */
import type { SourceHit, StoryRun } from "../../packages/core/src/types";
import { sourcedBrief, sourcedPack, sourcedRewrite } from "../../packages/desk/src/sourced";
import { getStyle } from "../../packages/core/src/styles";

export interface DemoStory {
  desk: string;
  title: string;
  outlet: string;
  page: string;
  still: string;
  body: string;
  caption: string;
}

const STORIES: DemoStory[] = [
  {
    desk: "pune",
    title: "Overnight bus routes go to a vote in Pune.",
    outlet: "City desk",
    page: "/sample-pune.html",
    still: "/assets/demo/pune.jpg",
    body: "Pune councillors take up the overnight bus plan this week. The page is a cached demo source so Browser can open a real URL.",
    caption: "Pune · overnight buses go to a vote. Cached demo pack — no Gemini.",
  },
  {
    desk: "pune",
    title: "Metro Phase 2 stations get weekend trial hours.",
    outlet: "City desk",
    page: "/sample-pune.html",
    still: "/assets/demo/pune.jpg",
    body: "Trial hours start on the new stretch this weekend. Demo fixture so the desk can finish a post without billing AI.",
    caption: "Pune · Metro Phase 2 weekend trials. Demo fixture.",
  },
  {
    desk: "mumbai",
    title: "Harbour line holds a late-night clearance window.",
    outlet: "City desk",
    page: "/sample-mumbai.html",
    still: "/assets/demo/mumbai.jpg",
    body: "A late-night clearance window is posted for the Harbour line. Cached demo source for Browser and the Magic Layer.",
    caption: "Mumbai · Harbour line late-night window. Cached demo pack.",
  },
  {
    desk: "mumbai",
    title: "Marine Drive stretch marked for Sunday cycle hours.",
    outlet: "City desk",
    page: "/sample-mumbai.html",
    still: "/assets/demo/mumbai.jpg",
    body: "Sunday cycle hours return on a marked stretch. Demo fixture for the public desk.",
    caption: "Mumbai · Sunday cycle hours on Marine Drive. Demo fixture.",
  },
  {
    desk: "delhi",
    title: "Yellow Line weekend work shifts to early Monday.",
    outlet: "City desk",
    page: "/sample-delhi.html",
    still: "/assets/demo/delhi.jpg",
    body: "Weekend engineering work on the Yellow Line moves to early Monday. Demo source page for Browser.",
    caption: "Delhi · Yellow Line work window. Cached demo pack.",
  },
  {
    desk: "bengaluru",
    title: "Whitefield feeder buses add a late last trip.",
    outlet: "City desk",
    page: "/sample-bengaluru.html",
    still: "/assets/demo/bengaluru.jpg",
    body: "A late last trip is added on Whitefield feeders. Demo fixture so Hunt and Canva still complete.",
    caption: "Bengaluru · late last trip on Whitefield feeders. Demo fixture.",
  },
  {
    desk: "hyderabad",
    title: "HITEC City feeder buses add late trips.",
    outlet: "City desk",
    page: "/sample-hyderabad.html",
    still: "/assets/demo/source.jpg",
    body: "Late feeder trips start on the HITEC City loop this week. Cached demo source for Browser and the Magic Layer.",
    caption: "Hyderabad · HITEC City late feeders. Cached demo pack.",
  },
  {
    desk: "hyderabad",
    title: "Tank Bund stretch marked for Sunday cycle hours.",
    outlet: "City desk",
    page: "/sample-hyderabad.html",
    still: "/assets/demo/source.jpg",
    body: "Sunday cycle hours return on a marked Tank Bund stretch. Demo fixture for the public desk.",
    caption: "Hyderabad · Tank Bund Sunday cycle hours. Demo fixture.",
  },
];


/** Demo Post still: city base photo (chrome + editable text layered in studio). */
export function demoStillFor(sourceUrl: string, desk?: string): string | null {
  const lower = (sourceUrl || "").toLowerCase();
  const map: Record<string, string> = {
    "sample-pune": "/assets/demo/pune.jpg",
    "sample-mumbai": "/assets/demo/mumbai.jpg",
    "sample-bengaluru": "/assets/demo/bengaluru.jpg",
    "sample-delhi": "/assets/demo/delhi.jpg",
    "sample-hyderabad": "/assets/demo/source.jpg",
  };
  for (const [key, path] of Object.entries(map)) {
    if (lower.includes(key)) return path;
  }
  const d = (desk || "").toLowerCase();
  if (d && map[`sample-${d}`]) return map[`sample-${d}`]!;
  return null;
}

export function requestBase(reqHost: string, proto = "http"): string {
  const fromEnv = (process.env.CUTLINE_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = (reqHost || "127.0.0.1:8787").replace(/\/$/, "");
  const scheme = proto === "https" || host.includes("vercel.app") ? "https" : proto;
  return `${scheme}://${host}`;
}

function abs(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function demoHits(deskId: string, base: string): { desk: string; label: string; hits: SourceHit[] } {
  const desk = (deskId || "pune").toLowerCase();
  const rows = STORIES.filter((s) => s.desk === desk);
  const use = rows.length ? rows : STORIES.filter((s) => s.desk === "pune");
  return {
    desk,
    label: desk[0]?.toUpperCase() + desk.slice(1),
    hits: use.map((s) => ({
      title: s.title,
      sourceUrl: abs(base, s.page),
      outlet: s.outlet,
      via: "fetch" as const,
      snippet: s.body,
    })),
  };
}

function matchStory(sourceUrl: string, title: string, desk?: string): DemoStory {
  const lower = (sourceUrl || "").toLowerCase();
  const byPage = STORIES.find((s) => lower.includes(s.page.replace(".html", "")) || lower.endsWith(s.page));
  if (byPage) return byPage;
  const byTitle = STORIES.find((s) => title && s.title.toLowerCase() === title.toLowerCase());
  if (byTitle) return byTitle;
  const byDesk = STORIES.find((s) => s.desk === (desk || "").toLowerCase());
  return byDesk || STORIES[0]!;
}

export function demoRun(opts: {
  sourceUrl?: string;
  title?: string;
  desk?: string;
  headline?: string;
  base: string;
}): StoryRun {
  const desk = (opts.desk || "pune").toLowerCase();
  const title = (opts.title || opts.headline || "").trim();
  const sourceUrl = (opts.sourceUrl || "").trim();
  const story = matchStory(sourceUrl, title, desk);
  const live = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : abs(opts.base, story.page);
  const headline = title || story.title;
  const still = abs(opts.base, story.still);
  const pageText = story.body;
  const style = getStyle("tight_news");
  const brief = sourcedBrief({ title: headline, sourceUrl: live, pageText });
  const rewrite = sourcedRewrite(brief, pageText, style.label);
  rewrite.caption = story.caption;
  const photo = {
    pathOrUrl: still,
    credit: "Pexels / city still",
    md5: "demo",
    via: "article_og" as const,
    bannedForPrint: false,
  };
  const pack = sourcedPack(rewrite, photo);
  pack.igCaption = story.caption;
  pack.canvaNotes = "Demo pack — open Canva with this headline.";
  const now = new Date().toISOString();
  return {
    id: `demo_${Date.now().toString(36)}`,
    beat: story.desk,
    status: "needs_input",
    hits: [
      {
        title: headline,
        sourceUrl: live,
        outlet: story.outlet,
        via: "fetch",
      },
    ],
    brief,
    rewrite,
    photo,
    photos: [
      { url: still, credit: "Pexels / city still" },
      { url: abs(opts.base, "/assets/demo/alt.jpg"), credit: "Alt still (cycle)" },
    ],
    pack,
    stillNote: "Using sourced photo",
    styleId: style.id,
    log: [
      { agent: "wire", at: now, action: "brief", ok: true, spendCents: 0, detail: "demo" },
      { agent: "still", at: now, action: "sourced", ok: true, spendCents: 0, detail: "demo fixture" },
      { agent: "desk", at: now, action: "pack", ok: true, spendCents: 0, detail: "demo" },
      { agent: "ship", at: now, action: "await_approve", ok: true, detail: "needs_input" },
    ],
    spendCents: 0,
    createdAt: now,
  };
}
