import type { SourceHit, BeatConfig } from "../../core/src/types";
export type { BeatConfig };

/** Hard rule: every hit must have sourceUrl you actually opened/fetched. */
export async function scoutBeat(
  beat: BeatConfig,
  deps: {
    fetchRss: (url: string) => Promise<{ title: string; link: string; outlet: string; summary?: string }[]>;
    tinyfishSearch?: (q: string) => Promise<SourceHit[]>;
    fetchPageOk: (url: string) => Promise<boolean>;
  },
  limit = 5
): Promise<SourceHit[]> {
  const hits: SourceHit[] = [];

  for (const feed of beat.rssFeeds) {
    const entries = await deps.fetchRss(feed);
    for (const e of entries) {
      const text = `${e.title} ${e.summary ?? ""}`.toLowerCase();
      if (!beat.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
      if (!(await deps.fetchPageOk(e.link))) continue; // URL-required
      hits.push({
        title: e.title,
        sourceUrl: e.link,
        outlet: e.outlet,
        snippet: e.summary,
        via: "rss",
      });
    }
  }

  if (hits.length < 3 && deps.tinyfishSearch && beat.tinyfishQuery) {
    const extra = await deps.tinyfishSearch(beat.tinyfishQuery);
    for (const h of extra) {
      if (!h.sourceUrl) continue;
      if (!(await deps.fetchPageOk(h.sourceUrl))) continue;
      hits.push({ ...h, via: "tinyfish" });
    }
  }

  // NEVER call gpt_fallback_headlines() — that Hyd weakness is banned in Cutline
  const dedup = new Map<string, SourceHit>();
  for (const h of hits) dedup.set(h.sourceUrl, h);
  return [...dedup.values()].slice(0, limit);
}

/** TinyFish HTTP — same contract as /root/dcn-mumbai/bin/tinyfish_search.py */
export function tinyfishUrl(query: string, location = "IN", recencyMinutes = 2880) {
  const u = new URL("https://api.search.tinyfish.ai");
  u.searchParams.set("query", query);
  u.searchParams.set("domain_type", "news");
  u.searchParams.set("location", location);
  u.searchParams.set("recency_minutes", String(recencyMinutes));
  return u.toString();
}
