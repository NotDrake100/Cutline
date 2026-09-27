/**
 * Paste a social / post URL → title, caption, thumb, source.
 * Demo: OG / oEmbed / fixtures only. Never Gemini.
 * Owner: same metadata, then optional Gemini tighten.
 */
import type { StoryRun } from "../../packages/core/src/types";
import { sourcedBrief, sourcedPack, sourcedRewrite } from "../../packages/desk/src/sourced";
import { getStyle } from "../../packages/core/src/styles";
import { fetchOgMeta, fetchYoutubeOEmbed, upgradeSocialImage } from "../../packages/scout/src/http";
import { parseGeminiJson } from "../../packages/core/src/gemini";
import { demoRun } from "./demo";

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
  const kind = classifyPostUrl(raw);
  /* "web" = any http(s) page — desk tips / articles use demoRun, not Analyze. */
  return kind !== null && kind !== "web";
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

/** Post frame: IG and X share 4:5. YouTube is 16:9. */
export function postFrameAspect(kind: SocialKind): "4 / 5" | "16 / 9" {
  return kind === "youtube" ? "16 / 9" : "4 / 5";
}

export interface SocialFixture {
  kind: SocialKind;
  title: string;
  body: string;
  caption: string;
  page: string;
  still: string;
  outlet: string;
}

/** Cached OG caption for Archit's showcase DCN post — used only when live OG is blocked. */
const DCN_IG_CAPTION =
  "A heartbreaking incident unfolded on BT Kawade Road, Pune, on September 25 around 4 PM. A 20-year-old youth, Vignesh Santosh Pawar from Ramtekdi, lost his life after losing balance while attempting to board a moving tractor-trolley returning from Ganesh Visarjan near Kalubai Chowk. He fell and was fatally injured when the trolley's rear wheel ran over him. Doctors at Sassoon Hospital declared him dead on arrival, and the body was subsequently sent to Command Hospital for autopsy. Local police have registered the case and are conducting further investigation.\n\n#PuneAccident #GaneshVisarjan #BTKawadeRoad #PuneNews #TragicIncident\n\n(BT Kawade Road, Ganesh Visarjan accident, Ramtekdi youth, Vighnesh Santosh Pawar, Tractor trolley accident, Pune news)\n\nCopyright Disclaimer: This post includes copyrighted material used under Fair Dealing (Section 52, Copyright Act, 1957) for the purpose of news reporting, criticism, review and public awareness. All rights belong to the respective owners.";

export const SOCIAL_FIXTURES: Record<"instagram" | "x" | "youtube", SocialFixture> = {
  instagram: {
    kind: "instagram",
    title: "DCN Pune on Instagram",
    body: DCN_IG_CAPTION,
    caption: DCN_IG_CAPTION,
    page: DCN_INSTAGRAM_POST,
    still: "/assets/demo/dcn-ig.jpg",
    outlet: "DCN Pune",
  },
  x: {
    kind: "x",
    title: "DCN: Harbour line late-night window.",
    body: "DCN posted the Harbour line clearance window on X. Cached demo analysis — no Gemini.",
    caption: "DCN · X · Harbour line late-night window. Sourced from the pasted post URL.",
    page: "/sample-dcn-x.html",
    still: "/assets/demo/dcn-x.jpg",
    outlet: "DCN",
  },
  youtube: {
    kind: "youtube",
    title: "DCN: Whitefield feeders add a late last trip.",
    body: "DCN posted the Whitefield feeder update on YouTube. Cached demo analysis — no Gemini.",
    caption: "DCN · YouTube · late last trip on Whitefield feeders. Sourced from the pasted post URL.",
    page: "/sample-dcn-yt.html",
    still: "/assets/demo/dcn-yt.jpg",
    outlet: "DCN",
  },
};

function fixtureFor(kind: SocialKind): SocialFixture {
  if (kind === "x") return SOCIAL_FIXTURES.x;
  if (kind === "youtube") return SOCIAL_FIXTURES.youtube;
  return SOCIAL_FIXTURES.instagram;
}

function weakTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return !t || t === "instagram" || t === "x" || t === "twitter" || t === "youtube" || t === "tiktok" || t === "facebook";
}

function looksTinyThumb(url: string): boolean {
  return /s1\d{2}x1\d{2}|s2\d{2}x2\d{2}|_s\.(jpg|webp)|150x150|320x320|\/s150|\/s240|\/s320/i.test(url || "");
}

/** Quoted body after "Name on Instagram:" / oEmbed wrappers. Never invents. */
export function captionFromSocialMeta(title: string, description: string): string {
  const quoted = (s: string) => {
    const m = String(s || "").match(/[“"]([\s\S]+)[”"]/);
    return m?.[1]?.trim() || "";
  };
  const afterOn = (s: string) => {
    const m = String(s || "").match(/on (?:Instagram|YouTube|X|Twitter):\s*[“"]?([\s\S]+?)[”"]?\s*$/i);
    return (m?.[1] || "").replace(/^[“"]|[”"]$/g, "").trim();
  };
  const likesWrap = (s: string) => {
    const m = String(s || "").match(/comments?\s+-\s+\S+\s+on\s+[^:]+:\s*[“"]([\s\S]+)[”"]/i);
    return m?.[1]?.trim() || "";
  };
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const extracted = [likesWrap(description), quoted(description), afterOn(title), quoted(title)]
    .map(clean)
    .filter((s) => s.length > 8 && !weakTitle(s) && !/^[^:]{0,40} on (?:Instagram|YouTube|X|Twitter):/i.test(s));
  if (extracted.length) return extracted.sort((a, b) => b.length - a.length)[0] || "";
  const fallbacks = [String(description || ""), afterOn(description), String(title || "")]
    .map(clean)
    .filter((s) => s.length > 8 && !weakTitle(s));
  return fallbacks.sort((a, b) => b.length - a.length)[0] || "";
}

/** In-panel embed for IG / X / YouTube. Address bar still shows the live post URL. */
export function socialEmbedUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    if (host === "instagram.com" || host === "instagr.am") {
      const i = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p.toLowerCase()));
      if (i >= 0 && parts[i + 1]) {
        const kind = parts[i].toLowerCase() === "reels" ? "reel" : parts[i].toLowerCase();
        return `https://www.instagram.com/${kind}/${parts[i + 1]}/embed/captioned/`;
      }
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") || (parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtu.be" && parts[0]) return `https://www.youtube.com/embed/${parts[0]}`;
    if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") {
      const si = parts.findIndex((p) => p === "status");
      if (si >= 0 && parts[si + 1]) {
        return `https://platform.twitter.com/embed/Tweet.html?id=${parts[si + 1]}`;
      }
    }
  } catch {
    /* keep empty */
  }
  return "";
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
  const showcaseIg = /instagram\.com\/p\/DdwHjcpId9B/i.test(sourceUrl);
  if (weakTitle(title)) title = fx.title;
  if (!body) body = fx.body;
  const extracted = captionFromSocialMeta(title, body);
  const caption = extracted || fx.caption || body || title;
  if (handle && /dcn/i.test(handle)) outlet = showcaseIg ? "DCN Pune" : "DCN";

  /* Local cached still — signed Instagram CDN URLs expire / 403 in-panel. Never rewrite size params. */
  const fixtureStill = fx.still;
  const upgraded = image ? upgradeSocialImage(image) : "";
  const cdnStill = /cdninstagram\.com|fbcdn\.net/i.test(upgraded || image || "");
  const still =
    kind === "instagram"
      ? fixtureStill
      : (!cdnStill && upgraded && !looksTinyThumb(upgraded) ? upgraded : "") || (!cdnStill ? upgraded : "") || fixtureStill;
  const headline = showcaseIg
    ? fx.title
    : kind === "instagram"
      ? (/on Instagram/i.test(title.split(":")[0] || "") ? title.split(":")[0]!.trim() : `${outlet} on Instagram`)
      : title || fx.title;

  const style = getStyle("tight_news");
  const brief = sourcedBrief({ title: headline, sourceUrl, pageText: caption || body });
  let rewrite = sourcedRewrite(brief, caption || body, style.label);
  rewrite.headline = headline;
  rewrite.caption = caption;
  rewrite.body = caption || body;

  if (opts.owner && opts.geminiText) {
    try {
      const raw = await opts.geminiText(
        `Rewrite this sourced social post as tight news JSON {"headline","caption"}. Do not invent facts. Keep the full caption — do not truncate.\nURL: ${sourceUrl}\nTitle: ${title}\nText: ${body}`
      );
      const parsed = parseGeminiJson<{ headline?: string; caption?: string }>(raw);
      if (parsed.headline) rewrite.headline = parsed.headline.trim();
      if (parsed.caption) rewrite.caption = parsed.caption.trim();
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
  const photos = [
    { url: still, credit: kind === "instagram" ? "Sourced still" : outlet },
    { url: fixtureStill, credit: "Sourced still" },
    { url: "/assets/demo/alt.jpg", credit: "Alt still" },
  ].filter((p, i, arr) => p.url && arr.findIndex((x) => x.url === p.url) === i);
  const now = new Date().toISOString();
  return {
    id: `post_${Date.now().toString(36)}`,
    beat: kind,
    status: "needs_input",
    hits: [{ title: rewrite.headline, sourceUrl, outlet, via: "fetch" }],
    brief,
    rewrite,
    photo,
    photos,
    pack,
    stillNote:
      kind === "instagram"
        ? "Cached still from the post — open Browser for the live photo"
        : image
          ? "Using post still"
          : "Using demo still — open the post in Browser",
    styleId: style.id,
    log: [
      { agent: "wire", at: now, action: "analyze", ok: true, spendCents: 0, detail: kind },
      { agent: "still", at: now, action: "sourced", ok: true, spendCents: 0 },
      { agent: "desk", at: now, action: "pack", ok: true, spendCents: 0 },
      { agent: "ship", at: now, action: "await_approve", ok: true, detail: "needs_input" },
    ],
    spendCents: 0,
    createdAt: now,
  };
}

/**
 * Same-type ask after Analyze: new similar news post, not a clone of the pasted caption.
 * Demo: city fixture + cached page. Never Gemini.
 */
export async function styleMatchFromPost(opts: {
  url: string;
  ask?: string;
  desk?: string;
  base: string;
  owner: boolean;
  geminiText?: (prompt: string) => Promise<string>;
}): Promise<StoryRun> {
  const refUrl = cleanPostUrl(opts.url);
  if (!/^https?:\/\//i.test(refUrl)) throw new Error("source_needed");
  const kind = classifyPostUrl(refUrl) || "web";
  const desk = (opts.desk || "pune").toLowerCase();
  const run = demoRun({ desk, base: opts.base });
  const now = new Date().toISOString();
  const note = `Same type as ${PLATFORM_LABEL[kind]} · new story. Style from ${refUrl}`;
  run.beat = desk;
  run.styleId = "tight_news";
  if (run.brief) run.brief.angle = note;
  if (run.pack) {
    run.pack.canvaNotes = note;
    /* Style-copy only: layer real DCN Hyderabad template chrome in studio */
    run.pack.templateChrome = "dcn_hyd";
  }
  run.stillNote = "DCN template chrome · edit headline on the card (style copy)";
  run.log = [
    { agent: "wire", at: now, action: "style_match", ok: true, spendCents: 0, detail: kind },
    { agent: "still", at: now, action: "sourced", ok: true, spendCents: 0, detail: "demo fixture" },
    { agent: "desk", at: now, action: "pack", ok: true, spendCents: 0, detail: "new_story" },
    { agent: "ship", at: now, action: "await_approve", ok: true, detail: "needs_input" },
  ];
  run.spendCents = 0;

  if (opts.owner && opts.geminiText) {
    try {
      const raw = await opts.geminiText(
        `Write a NEW tight-news post in the same style as this reference. Do not clone the caption. JSON {"headline","caption"}.\nReference: ${refUrl}\nAsk: ${opts.ask || "same type of post"}\nSeed: ${run.rewrite?.headline || ""}`
      );
      const parsed = parseGeminiJson<{ headline?: string; caption?: string }>(raw);
      if (parsed.headline && run.rewrite) run.rewrite.headline = parsed.headline.trim();
      if (parsed.caption) {
        if (run.rewrite) run.rewrite.caption = parsed.caption.trim();
        if (run.pack) run.pack.igCaption = parsed.caption.trim();
      }
    } catch {
      /* keep fixture new story */
    }
  }
  return run;
}
