import type { Pack, PhotoAsset, Rewrite, WireBrief } from "../../core/src/types";

/** First usable sentence from the opened page. Never invents. */
export function ledeFromPage(pageText: string, title: string): string {
  const t = String(pageText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return title.trim();
  const parts = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 24);
  const first =
    parts.find((p) => !/cookie|subscribe|sign in|newsletter|accept all|privacy/i.test(p)) ||
    parts[0] ||
    title;
  return first.slice(0, 320).trim();
}

export function sourcedBrief(hit: { title: string; sourceUrl: string; pageText: string }): WireBrief {
  const headline = (hit.title || "").trim() || "Story";
  const lede = ledeFromPage(hit.pageText, headline);
  return {
    headline,
    angle: lede,
    cityLead: "",
    visualPrompt: headline,
    facts: lede ? [lede] : [],
    sourceUrl: hit.sourceUrl,
  };
}

export function sourcedRewrite(brief: WireBrief, pageText: string, houseStyle = "Tight news"): Rewrite {
  const body = ledeFromPage(pageText, brief.headline);
  return {
    headline: brief.headline,
    body,
    caption: body,
    houseStyle,
    sourceUrl: brief.sourceUrl,
  };
}

export function sourcedPack(rewrite: Rewrite, photo?: PhotoAsset): Pack {
  const caption = (rewrite.caption || rewrite.body || rewrite.headline).trim();
  return {
    igCaption: caption,
    ytTitle: rewrite.headline,
    ytDescription: rewrite.body || caption,
    stillUrl: photo?.pathOrUrl,
  };
}
