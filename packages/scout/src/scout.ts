import type { SourceHit, BeatConfig } from "../../core/src/types";
export type { BeatConfig };

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

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
  const candidates: SourceHit[] = [];

  // Fetch feeds in parallel
  const feedResults = await Promise.all(
    beat.rssFeeds.map(async (feed) => {
      try {
        return await deps.fetchRss(feed);
      } catch {
        return [];
      }
    })
  );

  for (const entries of feedResults) {
    for (const e of entries) {
      const text = `${e.title} ${e.summary ?? ""}`.toLowerCase();
      // Empty keywords = accept all (e.g. global world feeds already curated).
      if (
        beat.keywords.length > 0 &&
        !beat.keywords.some((k) => text.includes(k.toLowerCase()))
      )
        continue;
      if (!e.link || !/^https?:\/\//i.test(e.link)) continue;
      candidates.push({
        title: e.title,
        sourceUrl: e.link,
        outlet: e.outlet,
        snippet: e.summary,
        via: "rss",
      });
    }
  }

  // URL-required: validate in parallel batches until we fill limit
  // (avoid stopping on first publisher that blocks bots, e.g. NYT).
  const hits: SourceHit[] = [];
  const batchSize = 12;
  for (let offset = 0; offset < candidates.length && hits.length < limit; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    const okFlags = await mapPool(batch, 6, (h) => deps.fetchPageOk(h.sourceUrl));
    for (let i = 0; i < batch.length; i++) {
      if (!okFlags[i]) continue;
      hits.push(batch[i]);
      if (hits.length >= limit) break;
    }
  }

  if (hits.length < 3 && deps.tinyfishSearch && beat.tinyfishQuery) {
    const extra = await deps.tinyfishSearch(beat.tinyfishQuery);
    const tfCands = extra.filter((h) => h.sourceUrl && /^https?:\/\//i.test(h.sourceUrl));
    const tfOk = await mapPool(tfCands.slice(0, 12), 6, (h) => deps.fetchPageOk(h.sourceUrl));
    for (let i = 0; i < tfCands.length && i < tfOk.length; i++) {
      if (!tfOk[i]) continue;
      hits.push({ ...tfCands[i], via: "tinyfish" });
      if (hits.length >= limit) break;
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
