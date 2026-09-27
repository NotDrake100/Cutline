import type { PhotoAsset } from "../../core/src/types";

/**
 * Cost order:
 * 1. local upload
 * 2. article OG / schema / img from sourceUrl
 * 3. stock photo (social only)
 * 4. Gemini gen — only if caller asks illustrated; bannedForPrint=true
 */
export async function resolvePhoto(
  opts: {
    sourceUrl: string;
    photoQuery: string;
    uploadPath?: string;
    allowGeminiGen?: boolean;
  },
  deps: {
    fetchArticleImage: (url: string) => Promise<{ url: string; credit: string } | null>;
    pexelsSearch: (q: string) => Promise<{ url: string } | null>;
    geminiImage?: (prompt: string) => Promise<{ url: string } | null>;
    md5: (bytes: ArrayBuffer) => string;
    download: (url: string) => Promise<ArrayBuffer>;
  }
): Promise<PhotoAsset | null> {
  if (opts.uploadPath) {
    return {
      pathOrUrl: opts.uploadPath,
      credit: "desk upload",
      md5: "upload",
      via: "upload",
      bannedForPrint: false,
    };
  }

  let article: { url: string; credit: string } | null = null;
  try {
    article = await deps.fetchArticleImage(opts.sourceUrl);
  } catch {
    article = null;
  }
  if (article?.url) {
    let md5 = "og";
    try {
      const buf = await deps.download(article.url);
      md5 = deps.md5(buf);
    } catch {
      /* page URL is enough — download is only for hash */
    }
    return {
      pathOrUrl: article.url,
      credit: article.credit,
      md5,
      via: "article_og",
      bannedForPrint: false,
    };
  }

  try {
    const pexels = await deps.pexelsSearch(opts.photoQuery || "news desk");
    if (pexels?.url) {
      let md5 = "pexels";
      try {
        const buf = await deps.download(pexels.url);
        md5 = deps.md5(buf);
      } catch {
        /* keep the stock URL */
      }
      return {
        pathOrUrl: pexels.url,
        credit: "Pexels",
        md5,
        via: "pexels",
        bannedForPrint: true, // social cards only
      };
    }
  } catch {
    /* stock optional */
  }

  if (opts.allowGeminiGen && deps.geminiImage) {
    try {
      const gen = await deps.geminiImage(opts.photoQuery);
      if (gen?.url) {
        return {
          pathOrUrl: gen.url,
          credit: "Generated",
          md5: "gen",
          via: "gemini_gen",
          bannedForPrint: true,
        };
      }
    } catch {
      /* 429 / quota — sourced photo or skip still; never fail the pack */
    }
  }

  return null;
}
