/**
 * SQLite media library — clips, photos, videos, captions, linked desk items.
 * File-backed. Not in-memory. Not localStorage.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DeskItem, LibraryEntry, MediaKind, MediaRecord } from "../../core/src/types";

const ROOT = join(import.meta.dirname, "../../..");
const DATA = join(ROOT, "data");
const DB_PATH = join(DATA, "cutline.db");

let db: DatabaseSync | null = null;

function open(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA, { recursive: true });
  db = new DatabaseSync(DB_PATH);
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
  if (!["clip", "photo", "video", "caption"].includes(input.kind)) {
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

export function saveRunToLibrary(input: {
  runId: string;
  desk: string;
  title: string;
  sourceUrl?: string | null;
  photoUrl?: string | null;
  photoMime?: string | null;
  caption?: string | null;
  clipUrl?: string | null;
}): LibraryEntry {
  const item = upsertDeskItem({
    desk: input.desk,
    title: input.title,
    sourceUrl: input.sourceUrl,
    runId: input.runId,
  });
  if (input.photoUrl) {
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
