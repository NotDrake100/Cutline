/**
 * SQLite media library — clips, photos, videos, captions, stills, style pref.
 * File-backed via better-sqlite3 (Node 20+). node:sqlite is Node 22-only.
 * Vercel writes to /tmp. Not localStorage.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { DeskItem, LibraryEntry, MediaKind, MediaRecord } from "../../core/src/types";
import { dbFile } from "../../core/src/paths";
import { DEFAULT_STYLE_ID, isStyleId } from "../../core/src/styles";

const DB_PATH = dbFile();
const KINDS: MediaKind[] = ["clip", "photo", "video", "caption", "still"];

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS desk_items (
      id TEXT PRIMARY KEY,
      desk TEXT,
      title TEXT NOT NULL,
      source_url TEXT,
      run_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      kind TEXT NOT NULL,
      title TEXT,
      body TEXT,
      url TEXT,
      mime TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES desk_items(id)
    );
    CREATE TABLE IF NOT EXISTS prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS media_created ON media(created_at);
    CREATE INDEX IF NOT EXISTS media_kind ON media(kind);
    CREATE INDEX IF NOT EXISTS items_created ON desk_items(created_at);
  `);
  return db;
}

function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowItem(r: Record<string, unknown>): DeskItem {
  return {
    id: String(r.id),
    desk: r.desk == null ? null : String(r.desk),
    title: String(r.title),
    sourceUrl: r.source_url == null ? null : String(r.source_url),
    runId: r.run_id == null ? null : String(r.run_id),
    createdAt: String(r.created_at),
  };
}

function rowMedia(r: Record<string, unknown>): MediaRecord {
  return {
    id: String(r.id),
    itemId: r.item_id == null ? null : String(r.item_id),
    kind: r.kind as MediaKind,
    title: r.title == null ? null : String(r.title),
    body: r.body == null ? null : String(r.body),
    url: r.url == null ? null : String(r.url),
    mime: r.mime == null ? null : String(r.mime),
    createdAt: String(r.created_at),
  };
}

export function dbPath(): string {
  return DB_PATH;
}

export function getPref(key: string): string | null {
  const row = open().prepare("SELECT value FROM prefs WHERE key = ?").get(key) as
    | { value?: string }
    | undefined;
  return row?.value != null ? String(row.value) : null;
}

export function setPref(key: string, value: string): void {
  open()
    .prepare(
      "INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}

export function getWritingStyleId(): string {
  const stored = getPref("writing_style");
  return isStyleId(stored) ? stored : DEFAULT_STYLE_ID;
}

export function setWritingStyleId(id: string): string {
  if (!isStyleId(id)) throw new Error("unknown_style");
  setPref("writing_style", id);
  return id;
}

export function upsertDeskItem(input: {
  id?: string;
  desk?: string | null;
  title: string;
  sourceUrl?: string | null;
  runId?: string | null;
}): DeskItem {
  const database = open();
  const id = input.id || nid("item");
  const createdAt = new Date().toISOString();
  const existing = database.prepare("SELECT * FROM desk_items WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (existing) {
    database
      .prepare(
        "UPDATE desk_items SET desk = COALESCE(?, desk), title = ?, source_url = COALESCE(?, source_url), run_id = COALESCE(?, run_id) WHERE id = ?"
      )
      .run(input.desk ?? null, input.title, input.sourceUrl ?? null, input.runId ?? null, id);
    const row = database.prepare("SELECT * FROM desk_items WHERE id = ?").get(id) as Record<string, unknown>;
    return rowItem(row);
  }
  database
    .prepare(
      "INSERT INTO desk_items (id, desk, title, source_url, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, input.desk ?? null, input.title, input.sourceUrl ?? null, input.runId ?? null, createdAt);
  return {
    id,
    desk: input.desk ?? null,
    title: input.title,
    sourceUrl: input.sourceUrl ?? null,
    runId: input.runId ?? null,
    createdAt,
  };
}

export function addMedia(input: {
  itemId?: string | null;
  kind: MediaKind;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  mime?: string | null;
}): MediaRecord {
  const database = open();
  if (!KINDS.includes(input.kind)) {
    throw new Error("invalid_media_kind");
  }
  const id = nid(input.kind);
  const createdAt = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO media (id, item_id, kind, title, body, url, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      id,
      input.itemId ?? null,
      input.kind,
      input.title ?? null,
      input.body ?? null,
      input.url ?? null,
      input.mime ?? null,
      createdAt
    );
  return {
    id,
    itemId: input.itemId ?? null,
    kind: input.kind,
    title: input.title ?? null,
    body: input.body ?? null,
    url: input.url ?? null,
    mime: input.mime ?? null,
    createdAt,
  };
}

export function listLibrary(): LibraryEntry[] {
  const database = open();
  const items = database
    .prepare("SELECT * FROM desk_items ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  const media = database
    .prepare("SELECT * FROM media ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  const byItem = new Map<string, MediaRecord[]>();
  const orphans: MediaRecord[] = [];
  for (const row of media) {
    const rec = rowMedia(row);
    if (rec.itemId) {
      const list = byItem.get(rec.itemId) || [];
      list.push(rec);
      byItem.set(rec.itemId, list);
    } else {
      orphans.push(rec);
    }
  }
  const entries: LibraryEntry[] = items.map((row) => {
    const item = rowItem(row);
    return { item, media: byItem.get(item.id) || [] };
  });
  for (const rec of orphans) {
    entries.push({
      item: {
        id: rec.id,
        desk: null,
        title: rec.title || rec.kind,
        sourceUrl: null,
        runId: null,
        createdAt: rec.createdAt,
      },
      media: [rec],
    });
  }
  entries.sort((a, b) => (a.item.createdAt < b.item.createdAt ? 1 : -1));
  return entries;
}

export function getLibraryEntry(id: string): LibraryEntry | null {
  const database = open();
  const itemRow = database.prepare("SELECT * FROM desk_items WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (itemRow) {
    const mediaRows = database.prepare("SELECT * FROM media WHERE item_id = ? ORDER BY created_at DESC").all(id) as Record<
      string,
      unknown
    >[];
    return { item: rowItem(itemRow), media: mediaRows.map(rowMedia) };
  }
  const mediaRow = database.prepare("SELECT * FROM media WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!mediaRow) return null;
  const rec = rowMedia(mediaRow);
  return {
    item: {
      id: rec.id,
      desk: null,
      title: rec.title || rec.kind,
      sourceUrl: null,
      runId: null,
      createdAt: rec.createdAt,
    },
    media: [rec],
  };
}

export function findDeskItemByRunId(runId: string): DeskItem | null {
  if (!runId) return null;
  const database = open();
  const row = database
    .prepare("SELECT * FROM desk_items WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(runId) as Record<string, unknown> | undefined;
  return row ? rowItem(row) : null;
}

export function findDeskItemBySourceUrl(sourceUrl: string): DeskItem | null {
  const src = (sourceUrl || "").replace(/[?#].*$/, "").replace(/\/$/, "");
  if (!src) return null;
  const database = open();
  const row = database
    .prepare("SELECT * FROM desk_items WHERE source_url = ? OR source_url LIKE ? ORDER BY created_at DESC LIMIT 1")
    .get(src, src + "%") as Record<string, unknown> | undefined;
  return row ? rowItem(row) : null;
}

export function saveRunToLibrary(input: {
  runId: string;
  desk: string;
  title: string;
  sourceUrl?: string | null;
  photoUrl?: string | null;
  photoMime?: string | null;
  stillUrl?: string | null;
  stillMime?: string | null;
  caption?: string | null;
  clipUrl?: string | null;
}): LibraryEntry {
  const existing =
    findDeskItemByRunId(input.runId) ||
    (input.sourceUrl ? findDeskItemBySourceUrl(input.sourceUrl) : null);
  const item = upsertDeskItem({
    id: existing?.id,
    desk: input.desk,
    title: input.title,
    sourceUrl: input.sourceUrl,
    runId: input.runId,
  });
  if (input.stillUrl) {
    addMedia({
      itemId: item.id,
      kind: "still",
      title: input.title,
      url: input.stillUrl,
      mime: input.stillMime || "image/*",
    });
  }
  if (input.photoUrl && input.photoUrl !== input.stillUrl) {
    addMedia({
      itemId: item.id,
      kind: "photo",
      title: input.title,
      url: input.photoUrl,
      mime: input.photoMime || "image/*",
    });
  }
  if (input.caption) {
    addMedia({
      itemId: item.id,
      kind: "caption",
      title: input.title,
      body: input.caption,
    });
  }
  if (input.clipUrl) {
    addMedia({
      itemId: item.id,
      kind: "clip",
      title: input.title,
      url: input.clipUrl,
      mime: "video/*",
    });
  }
  return getLibraryEntry(item.id)!;
}
