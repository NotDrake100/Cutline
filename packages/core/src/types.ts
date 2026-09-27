/** Cutline core contracts — source-first newsroom OS */

export type RunStatus =
  | "hunting"
  | "drafting"
  | "needs_input"
  | "approved"
  | "shipped"
  | "failed";

export type AgentName =
  | "scout"
  | "wire"
  | "sub"
  | "photo"
  | "still"
  | "clip"
  | "desk"
  | "ship"
  | "night";

export interface SourceHit {
  title: string;
  sourceUrl: string; // REQUIRED — no URL = drop
  outlet: string;
  publishedAt?: string;
  snippet?: string;
  via: "rss" | "tinyfish" | "outlet_fetch" | "manual";
}

export interface WireBrief {
  headline: string;
  angle: string;
  cityLead: string; // e.g. "Hyderabad:" / "Pune:"
  visualPrompt: string;
  facts: string[];
  sourceUrl: string;
}

export interface Rewrite {
  headline: string; // sentence-case for print; ALL CAPS ok for social lane
  body: string;
  caption?: string;
  houseStyle: string;
  sourceUrl: string;
}

export interface PhotoAsset {
  pathOrUrl: string;
  credit: string;
  md5: string;
  via: "upload" | "article_og" | "pexels" | "gemini_gen";
  bannedForPrint: boolean; // true if pexels/gemini — social only
}

export interface Pack {
  igCaption: string;
  ytTitle: string;
  ytDescription: string;
  canvaNotes?: string;
  stillUrl?: string;
  clipUrl?: string;
}

export interface AgentLogEntry {
  agent: AgentName;
  at: string; // ISO
  action: string;
  spendCents?: number;
  ok: boolean;
  detail?: string;
}

export interface StoryRun {
  id: string;
  beat: string; // "hyderabad" | "mumbai" | "global:tech" | …
  status: RunStatus;
  hits: SourceHit[];
  brief?: WireBrief;
  rewrite?: Rewrite;
  photo?: PhotoAsset;
  pack?: Pack;
  log: AgentLogEntry[];
  spendCents: number;
  createdAt: string;
}


export interface BeatConfig {
  id: string;
  keywords: string[];
  rssFeeds: string[];
  tinyfishQuery?: string;
  location?: string;
}


export interface WedgeRequest {
  headline: string;
  demoId?: string;
}

export interface WedgeResponse {
  run: StoryRun;
}
