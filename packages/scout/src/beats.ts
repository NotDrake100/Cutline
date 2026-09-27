import type { BeatConfig } from "../../core/src/types";

/**
 * Seed beats — expand globally by adding data, not new products.
 * Hyderabad RSS_FEEDS = live bot array in /root/dcn/telegram_bot.py (NOT full sources.yaml).
 * sources.yaml tier3 Telugu (TV9, Eenadu, NTNews, V6) = future/data-only until wired.
 * Verified read-only by DCN VM Closer 27 Sep 2026.
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
    keywords: ["mumbai", "bmc", "mmrda", "best", "harbour", "thane"],
    rssFeeds: [],
    tinyfishQuery: "Mumbai civic news",
    location: "IN",
  },
};
