import type { BeatConfig } from "../../core/src/types";

/**
 * Seed beats — expand globally by adding data, not new products.
 * Hyderabad RSS_FEEDS = live bot array in /root/dcn/telegram_bot.py (NOT full sources.yaml).
 * sources.yaml tier3 Telugu (TV9, Eenadu, NTNews, V6) = future/data-only until wired.
 * Verified read-only by DCN VM Closer 27 Sep 2026.
 *
 * Mumbai / Pune / India / Global feeds = public URLs HEAD-checked 27 Sep 2026 (Cutline box).
 * Do not invent publisher URLs.
 */
export const BEATS: Record<string, BeatConfig> = {
  hyderabad: {
    id: "hyderabad",
    keywords: [
      "hyderabad",
      "telangana",
      "ghmc",
      "secunderabad",
      "cyberabad",
      "hitec city",
      "gachibowli",
      "tsrtc",
      "hmda",
      "banjara hills",
      "jubilee hills",
      "ameerpet",
      "jawaharnagar",
      "tsnpdcl",
    ],
    rssFeeds: [
      "https://www.siasat.com/feed/",
      "https://telanganatoday.com/feed",
      "https://www.thehansindia.com/feed",
      "https://www.deccanchronicle.com/google_feeds.xml",
      "https://www.hyderabadmail.com/feed",
      "https://greattelangana.com/feed",
      "https://telanganatribune.com/feed",
    ],
    tinyfishQuery: "Hyderabad Telangana news",
    location: "IN",
  },
  mumbai: {
    id: "mumbai",
    keywords: [
      "mumbai",
      "bmc",
      "mmrda",
      "best",
      "harbour",
      "thane",
      "navi mumbai",
      "bandra",
      "andheri",
      "dadar",
      "worli",
      "colaba",
      "maharashtra",
      "local train",
      "cst",
      "csmt",
    ],
    rssFeeds: [
      "https://indianexpress.com/section/cities/mumbai/feed/",
      "https://www.hindustantimes.com/feeds/rss/cities/mumbai-news/rssfeed.xml",
      "https://www.freepressjournal.in/stories.rss",
    ],
    tinyfishQuery: "Mumbai Maharashtra news",
    location: "IN",
  },
  pune: {
    id: "pune",
    keywords: [
      "pune",
      "pmc",
      "pcmc",
      "deccan",
      "hadapsar",
      "hinjewadi",
      "kothrud",
      "baner",
      "wakad",
      "pimpri",
      "chinchwad",
      "shivajinagar",
      "swargate",
      "magarpatta",
      "aundh",
    ],
    rssFeeds: [
      "https://indianexpress.com/section/cities/pune/feed/",
      "https://www.hindustantimes.com/feeds/rss/cities/pune-news/rssfeed.xml",
      "https://www.punekarnews.in/feed/",
      "https://punemirror.com/feed",
    ],
    tinyfishQuery: "Pune civic news",
    location: "IN",
  },
  india: {
    id: "india",
    keywords: [], // national feeds already curated — accept all URL-ok items
    rssFeeds: [
      "https://www.thehindu.com/news/national/feeder/default.rss",
      "https://feeds.feedburner.com/ndtvnews-top-stories",
      "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
      "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    ],
    tinyfishQuery: "India latest news",
    location: "IN",
  },
  global: {
    id: "global",
    // Empty keywords = accept all RSS items from world feeds (scoutBeat).
    keywords: [],
    rssFeeds: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      "https://www.theguardian.com/world/rss",
    ],
    tinyfishQuery: "latest world news",
    location: "US",
    recencyMinutes: 360,
  },
};

/** Stable beat id list for API / UI. */
export function listBeats(): BeatConfig[] {
  return Object.values(BEATS);
}

export function getBeat(id: string): BeatConfig | undefined {
  return BEATS[id];
}
