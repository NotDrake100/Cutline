/**
 * Photo HTTP adapters — article download + optional Pexels.
 * Missing Pexels key → null (no invented still).
 */
import { ENV } from "../../core/src/env";

const UA = "CutlinePhoto/0.1 (+https://cutline.local)";

export async function downloadBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/*,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`photo_download_${res.status}`);
  return res.arrayBuffer();
}

export function hasPexelsKey(): boolean {
  const v = process.env[ENV.PEXELS_API_KEY];
  return !!(v && v.trim());
}

export async function pexelsSearch(query: string): Promise<{ url: string } | null> {
  if (!hasPexelsKey() || !query?.trim()) return null;
  try {
    const q = new URL("https://api.pexels.com/v1/search");
    q.searchParams.set("query", query.trim().slice(0, 120));
    q.searchParams.set("per_page", "1");
    q.searchParams.set("orientation", "portrait");
    const res = await fetch(q, {
      headers: {
        Authorization: process.env[ENV.PEXELS_API_KEY]!.trim(),
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: { src?: { large?: string; original?: string; portrait?: string } }[];
    };
    const src = data.photos?.[0]?.src;
    const url = src?.large || src?.portrait || src?.original || "";
    return url.startsWith("http") ? { url } : null;
  } catch {
    return null;
  }
}
