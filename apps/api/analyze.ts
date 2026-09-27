/**
 * Paste a social / post URL → title, caption, thumb, source.
 * Demo: OG / oEmbed / fixtures only. Never Gemini.
 * Owner: same metadata, then optional Gemini tighten.
 */
import type { StoryRun } from "../../packages/core/src/types";
import { sourcedBrief, sourcedPack, sourcedRewrite } from "../../packages/desk/src/sourced";
import { getStyle } from "../../packages/core/src/styles";
import { fetchOgMeta, fetchYoutubeOEmbed } from "../../packages/scout/src/http";
import { parseGeminiJson } from "../../packages/core/src/gemini";

/** Archit's showcase DCN Instagram post. Strip ?stkn= and other query junk. */
export const DCN_INSTAGRAM_POST = "https://www.instagram.com/p/DdwHjcpId9B/";

export type SocialKind = "instagram" | "x" | "youtube" | "tiktok" | "facebook" | "threads" | "web";

export function cleanPostUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.search = "";
    u.hash = "";
    if (u.hostname.replace(/^www\./, "") === "instagram.com" && /\/p\/DdwHjcpId9B/i.test(u.pathname)) {
      return DCN_INSTAGRAM_POST;
    }
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export function classifyPostUrl(raw: string): SocialKind | null {
  let host = "";
  try {
    host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (host === "instagram.com" || host === "instagr.am") return "instagram";
  if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") return "x";
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") return "youtube";
  if (host === "tiktok.com") return "tiktok";
  if (host === "facebook.com" || host === "fb.com" || host === "m.facebook.com") return "facebook";
  if (host === "threads.net") return "threads";
  if (/sample-dcn-ig/i.test(raw)) return "instagram";
  if (/sample-dcn-x/i.test(raw)) return "x";
  if (/sample-dcn-yt/i.test(raw)) return "youtube";
  return /^https?:\/\//i.test(raw) ? "web" : null;
}

export function isPostUrl(raw: string): boolean {
  return classifyPostUrl(raw) !== null;
}

function handleFromUrl(url: string, kind: SocialKind): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (kind === "instagram" && parts[0] && !["p", "reel", "reels", "tv", "stories"].includes(parts[0].toLowerCase())) {
      return parts[0].replace(/^@/, "");
    }
    if (kind === "instagram" && parts[0] === "p" && parts[1]) return "dcn";
    if (kind === "x" && parts[0] && !["i", "intent", "share"].includes(parts[0].toLowerCase())) {
      return parts[0].replace(/^@/, "");
    }
    if (kind === "youtube") return "DCN";
  } catch {
    /* keep default */
  }
  return "dcn";
}

const PLATFORM_LABEL: Record<SocialKind, string> = {
  instagram: "Instagram",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  threads: "Threads",
  web: "Source",
};

export interface SocialFixture {
  kind: SocialKind;
  title: string;
  body: string;
  caption: string;
  page: string;
  still: string;
  outlet: string;
}

export const SOCIAL_FIXTURES: Record<"instagram" | "x" | "youtube", SocialFixture> = {
  instagram: {
    kind: "instagram",
    title: "DCN on Instagram",
    body: "Sourced from the DCN Instagram post. Demo uses the live URL — OG when Instagram allows it, this pack when fetch is blocked. No Gemini.",
    caption: "DCN · Instagram. Sourced from instagram.com/p/DdwHjcpId9B",
    page: DCN_INSTAGRAM_POST,
    still: "/assets/demo/dcn-ig.svg",
    outlet: "DCN",
  },
  x: {
    kind: "x",
    title: "DCN: Harbour line late-night window.",
    body: "DCN posted the Harbour line clearance window on X. Cached demo analysis — no Gemini.",
    caption: "DCN · X · Harbour line late-night window. Sourced from the pasted post URL.",
    page: "/sample-dcn-x.html",
    still: "/assets/demo/dcn-x.svg",
    outlet: "DCN",
  },
  youtube: {
    kind: "youtube",
    title: "DCN: Whitefield feeders add a late last trip.",
    body: "DCN posted the Whitefield feeder update on YouTube. Cached demo analysis — no Gemini.",
    caption: "DCN · YouTube · late last trip on Whitefield feeders. Sourced from the pasted post URL.",
    page: "/sample-dcn-yt.html",
    still: "/assets/demo/dcn-yt.svg",
    outlet: "DCN",
  },
};

function fixtureFor(kind: SocialKind): SocialFixture {
  if (kind === "x") return SOCIAL_FIXTURES.x;
  if (kind === "youtube") return SOCIAL_FIXTURES.youtube;
  return SOCIAL_FIXTURES.instagram;
}

function abs(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function weakTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return !t || t === "instagram" || t === "x" || t === "twitter" || t === "youtube" || t === "tiktok" || t === "facebook";
}

export async function analyzePostUrl(opts: {
  url: string;
  base: string;
  owner: boolean;
  geminiText?: (prompt: string) => Promise<string>;
}): Promise<StoryRun> {
  const sourceUrl = cleanPostUrl(opts.url);
  if (!/^https?:\/\//i.test(sourceUrl)) throw new Error("source_needed");
  const kind = classifyPostUrl(sourceUrl) || "web";
  const fx = fixtureFor(kind === "web" ? "instagram" : kind);
  const handle = handleFromUrl(sourceUrl, kind);

  let title = "";
  let body = "";
  let image = "";
  let outlet = PLATFORM_LABEL[kind];

  if (kind === "youtube") {
    const yt = await fetchYoutubeOEmbed(sourceUrl);
    if (yt) {
      title = yt.title;
      body = yt.author ? `${yt.author} on YouTube.` : yt.title;
      image = yt.thumbnail;
      outlet = yt.author || "YouTube";
    }
  }
  if (!title || !image) {
    const og = await fetchOgMeta(sourceUrl);
    if (og) {
      if (!weakTitle(og.title)) title = title || og.title;
      body = body || og.description;
      image = image || og.image;
      if (og.siteName) outlet = og.siteName;
    }
  }

  /* Demo / blocked social: fixtures fill gaps. Pasted URL stays the source. */
  if (weakTitle(title)) title = fx.title;
  if (!body) body = fx.body;
  const still = image || abs(opts.base, fx.still);
  const caption = weakTitle(title) ? fx.caption : `${outlet} · ${title}`.slice(0, 220);
  if (handle && /dcn/i.test(handle)) outlet = "DCN";

  const style = getStyle("tight_news");
  const brief = sourcedBrief({ title, sourceUrl, pageText: body });
  let rewrite = sourcedRewrite(brief, body, style.label);
  rewrite.caption = caption;

  if (opts.owner && opts.geminiText) {
    try {
      const raw = await opts.geminiText(
        `Rewrite this sourced social post as tight news JSON {"headline","caption"}. Do not invent facts.\nURL: ${sourceUrl}\nTitle: ${title}\nText: ${body}`
      );
      const parsed = parseGeminiJson<{ headline?: string; caption?: string }>(raw);
      if (parsed.headline) rewrite.headline = parsed.headline.slice(0, 160);
      if (parsed.caption) rewrite.caption = parsed.caption.slice(0, 400);
    } catch {
      /* keep OG / fixture pack */
    }
  }

  const photo = {
    pathOrUrl: still,
    credit: outlet,
    md5: image ? "og" : "demo",
    via: "article_og" as const,
    bannedForPrint: false,
  };
  const pack = sourcedPack(rewrite, photo);
  pack.igCaption = rewrite.caption || pack.igCaption;
  pack.canvaNotes = `${PLATFORM_LABEL[kind]} post → Cutline pack.`;
  const now = new Date().toISOString();
  return {
    id: `post_${Date.now().toString(36)}`,
    beat: kind,
    status: "needs_input",
    hits: [{ title: rewrite.headline, sourceUrl, outlet, via: "fetch" }],
    brief,
    rewrite,
    photo,
    photos: [
      { url: still, credit: outlet },
      { url: abs(opts.base, fx.still), credit: "Demo still" },
    ],
    pack,
    stillNote: image ? "Using post thumb" : "Using demo still",
    styleId: style.id,
    log: [
      { agent: "wire", at: now, action: "analyze", ok: true, spendCents: 0, detail: kind },
      { agent: "still", at: now, action: image ? "sourced" : "sourced", ok: true, spendCents: 0 },
      { agent: "desk", at: now, action: "pack", ok: true, spendCents: 0 },
      { agent: "ship", at: now, action: "await_approve", ok: true, detail: "needs_input" },
    ],
    spendCents: 0,
    createdAt: now,
  };
}
