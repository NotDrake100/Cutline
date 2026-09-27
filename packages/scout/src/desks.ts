import type { BeatConfig } from "../../core/src/types";

/**
 * Product desks. Each desk lists public section pages to open.
 * Hunt fetches those pages and keeps only live article URLs.
 */
export const DESKS: Record<string, BeatConfig> = {
  breaking: {
    id: "breaking",
    label: "Breaking",
    keywords: [],
    sources: [
      "https://www.bbc.com/news",
      "https://www.reuters.com/world/",
      "https://apnews.com/",
    ],
  },
  business: {
    id: "business",
    label: "Business",
    keywords: [],
    sources: [
      "https://www.bbc.com/business",
      "https://www.reuters.com/business/",
      "https://www.theguardian.com/business",
    ],
  },
  culture: {
    id: "culture",
    label: "Culture",
    keywords: [],
    sources: [
      "https://www.bbc.com/culture",
      "https://www.theguardian.com/culture",
      "https://www.npr.org/sections/arts/",
    ],
  },
  sports: {
    id: "sports",
    label: "Sports",
    keywords: [],
    sources: [
      "https://www.bbc.com/sport",
      "https://www.espn.com/",
      "https://www.theguardian.com/sport",
    ],
  },
  tech: {
    id: "tech",
    label: "Tech",
    keywords: [],
    sources: [
      "https://www.theverge.com/tech",
      "https://www.bbc.com/innovation",
      "https://arstechnica.com/",
    ],
  },
  world: {
    id: "world",
    label: "World",
    keywords: [],
    sources: [
      "https://www.bbc.com/news/world",
      "https://www.aljazeera.com/news/",
      "https://www.reuters.com/world/",
    ],
  },
};

export const BEATS = DESKS;

export function listDesks(): BeatConfig[] {
  return Object.values(DESKS);
}

export function getDesk(id: string): BeatConfig | undefined {
  return DESKS[id];
}

export function listBeats(): BeatConfig[] {
  return listDesks();
}

export function getBeat(id: string): BeatConfig | undefined {
  return getDesk(id);
}
