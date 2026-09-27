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

  const article = await deps.fetchArticleImage(opts.sourceUrl);
  if (article) {
    const buf = await deps.download(article.url);
    return {
      pathOrUrl: article.url,
      credit: article.credit,
      md5: deps.md5(buf),
      via: "article_og",
      bannedForPrint: false,
    };
  }

  const pexels = await deps.pexelsSearch(opts.photoQuery || "news desk");
  if (pexels) {
    const buf = await deps.download(pexels.url);
    return {
      pathOrUrl: pexels.url,
      credit: "Pexels",
      md5: deps.md5(buf),
      via: "pexels",
      bannedForPrint: true, // social cards only
    };
  }

  if (opts.allowGeminiGen && deps.geminiImage) {
    const gen = await deps.geminiImage(opts.photoQuery);
    if (gen) {
      return {
        pathOrUrl: gen.url,
        credit: "Generated",
        md5: "gen",
        via: "gemini_gen",
        bannedForPrint: true,
      };
    }
  }

  return null;
}
