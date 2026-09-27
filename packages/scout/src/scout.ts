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

export interface HuntDeps {
  fetchSection: (url: string) => Promise<{ title: string; link: string; outlet: string; summary?: string }[]>;
  fetchPageOk: (url: string) => Promise<boolean>;
}

/** Hard rule: every hit must have a live sourceUrl the desk opened. */
export async function scoutBeat(
  beat: BeatConfig,
  deps: HuntDeps,
  limit = 5
): Promise<SourceHit[]> {
  const sources = beat.sources || [];
  const candidates: SourceHit[] = [];

  const sectionResults = await Promise.all(
    sources.map(async (page) => {
      try {
        return await deps.fetchSection(page);
      } catch {
        return [];
      }
    })
  );

  for (const entries of sectionResults) {
    for (const e of entries) {
      const text = `${e.title} ${e.summary ?? ""}`.toLowerCase();
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
        via: "fetch",
      });
    }
  }

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

  const dedup = new Map<string, SourceHit>();
  for (const h of hits) dedup.set(h.sourceUrl, h);
  return [...dedup.values()].slice(0, limit);
}
