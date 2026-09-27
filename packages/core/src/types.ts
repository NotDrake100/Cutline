/** Cutline core contracts — source-first AI desk */

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

export type SourceVia = "fetch" | "manual";

export interface SourceHit {
  title: string;
  sourceUrl: string; // REQUIRED — no URL = drop
  outlet: string;
  publishedAt?: string;
  snippet?: string;
  via: SourceVia;
}

export interface WireBrief {
  headline: string;
  angle: string;
  cityLead: string;
  visualPrompt: string;
  facts: string[];
  sourceUrl: string;
}

export interface Rewrite {
  headline: string;
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
  bannedForPrint: boolean;
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
  at: string;
  action: string;
  spendCents?: number;
  ok: boolean;
  detail?: string;
}

export interface StoryRun {
  id: string;
  beat: string;
  status: RunStatus;
  hits: SourceHit[];
  brief?: WireBrief;
  rewrite?: Rewrite;
  photo?: PhotoAsset;
  pack?: Pack;
  photos?: { url: string; credit: string }[];
  /** Quiet UI copy when Gemini still is skipped — never an error code. */
  stillNote?: string;
  styleId?: string;
  log: AgentLogEntry[];
  spendCents: number;
  createdAt: string;
}

/** Product desk — section pages to fetch, never a branded feed list. */
export interface BeatConfig {
  id: string;
  label: string;
  keywords: string[];
  sources: string[];
}

export interface WedgeRequest {
  headline: string;
  styleId?: string;
}

export interface WedgeResponse {
  run: StoryRun;
  mode?: "wedge";
}

export interface DeskRequest {
  sourceUrl?: string;
  title?: string;
  beat?: string;
  beatId?: string;
  outlet?: string;
  styleId?: string;
}

export interface DeskResponse {
  run: StoryRun;
  mode?: "desk";
}

export type MediaKind = "clip" | "photo" | "video" | "caption" | "still";

export interface DeskItem {
  id: string;
  desk: string | null;
  title: string;
  sourceUrl: string | null;
  runId: string | null;
  createdAt: string;
}

export interface MediaRecord {
  id: string;
  itemId: string | null;
  kind: MediaKind;
  title: string | null;
  body: string | null;
  url: string | null;
  mime: string | null;
  createdAt: string;
}

export interface LibraryEntry {
  item: DeskItem;
  media: MediaRecord[];
}
