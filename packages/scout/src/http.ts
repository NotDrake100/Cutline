/**
 * Live hunt HTTP — open section pages, keep live article URLs.
 * Never invent URLs. Never log secrets.
 */
const UA = "CutlineDesk/0.1";
const TIMEOUT_MS = 8_000;

const SKIP_TITLE =
  /^(home|news|sport|sports|business|culture|tech|world|video|live|sign in|subscribe|menu|skip|more|account|watch|listen|weather|markets)$/i;

function outletFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] || host;
  } catch {
    return "unknown";
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function absUrl(base: string, maybe: string): string {
  try {
    const href = new URL(maybe, base).href;
    return /^https?:\/\//i.test(href) ? href.split("#")[0] : "";
  } catch {
    return "";
  }
}

function looksLikeArticle(link: string, sectionUrl: string): boolean {
  let parsed: URL;
  let section: URL;
  try {
    parsed = new URL(link);
    section = new URL(sectionUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const path = parsed.pathname;
  if (path.length < 12) return false;
  if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|mp4|xml)$/i.test(path)) return false;
  if (/\/(cdn-cgi|privacy|terms|about|contact|login|subscribe|account|video\/docs|category)\b/i.test(path)) {
    return false;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const sectionHost = section.hostname.replace(/^www\./, "");
  if (host !== sectionHost && !host.endsWith(`.${sectionHost}`) && !sectionHost.endsWith(`.${host}`)) {
    return false;
  }
  if (/\/(articles?|story|stories)\//i.test(path)) return true;
  if (/\/\d{4}\/\d{1,2}\//.test(path)) return true;
  if (/-\d{5,}(?:$|\/)/.test(path)) return true;
  if (/\/story\/_\/id\//i.test(path)) return true;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  if (/^[a-z_]+$/i.test(last) && !/\d/.test(last)) return false;
  if (parts.length >= 3 && last.length >= 28) return true;
  return false;
}

function stripTags(html: string): string {
  const t = decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const stop = t.search(/(?<=\w[.!?])\s+[A-Z“"]/);
  if (stop > 24 && stop < 140) return t.slice(0, stop);
  const mash = t.search(/(?<=[a-z0-9])\s+(The|A|An|After|As)\s+[A-Za-z]/);
  if (mash > 28 && mash < 140) return t.slice(0, mash);
  return t.slice(0, 90);
}

/** Open a section page and collect article links. Skip on failure. */
export async function fetchSection(
  url: string
): Promise<{ title: string; link: string; outlet: string; summary?: string }[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const outlet = outletFromUrl(url);
    const seen = new Set<string>();
    const out: { title: string; link: string; outlet: string; summary?: string }[] = [];
    const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 40) {
      const link = absUrl(url, m[1]);
      if (!link || seen.has(link) || !looksLikeArticle(link, url)) continue;
      const title = stripTags(m[2]).slice(0, 220);
      if (title.length < 18 || SKIP_TITLE.test(title)) continue;
      seen.add(link);
      out.push({ title, link, outlet });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Fast URL liveness check. Prefer HEAD; treat bot-walls as OK (URL is real).
 * Never invent URLs — only validate ones already extracted from a fetched page.
 */
export async function fetchPageOk(url: string): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const head = async (): Promise<"ok" | "dead" | "retry"> => {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(2500),
        headers: { "User-Agent": UA, Accept: "*/*" },
        redirect: "follow",
      });
      if (res.status >= 200 && res.status < 400) return "ok";
      if (res.status === 401 || res.status === 403 || res.status === 405) return "ok";
      if (res.status === 404 || res.status === 410) return "dead";
      return "retry";
    } catch {
      return "retry";
    }
  };
  const h = await head();
  if (h === "ok") return true;
  if (h === "dead") return false;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
      headers: { "User-Agent": UA, Accept: "text/html,*/*", Range: "bytes=0-512" },
      redirect: "follow",
    });
    try {
      res.body?.cancel();
    } catch {
      /* ignore */
    }
    if (res.status === 404 || res.status === 410) return false;
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Fetch opened source page as plain text. Never invents a URL. */
export async function fetchPageText(url: string): Promise<string> {
  if (!url || !/^https?:\/\//i.test(url)) throw new Error("sourceUrl must be a live http(s) URL");
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`source_fetch_${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

/** Story-page still from OG / Twitter. Returns null if none — never invents. */
export async function fetchArticleImage(url: string): Promise<{ url: string; credit: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      const img = m?.[1] ? absUrl(url, m[1].trim()) : "";
      if (img) return { url: img, credit: outletFromUrl(url) };
    }
    return null;
  } catch {
    return null;
  }
}

export function createScoutDeps() {
  return {
    fetchSection,
    fetchPageOk,
  };
}
