/**
 * Cutline HTTP — desk + pasted-headline wedge + library. Port 8787.
 * Serves apps/web + API. Never logs secrets.
 *
 * Demo vs owner AI: anonymous requests take fixture paths in handleApi.
 * Gemini generateContent is only entered via withGeminiPermit after isOwnerRequest.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import { handleWedge } from "./wedge";
import { ensureDeskLog, handleDesk } from "./desk";
import { gemini, withGeminiPermit } from "../../packages/core/src/gemini";
import {
  demoAiBlocked,
  isOwnerRequest,
  ownerCookieHeader,
  ownerKey,
  requestIp,
} from "../../packages/core/src/owner";
import { demoHits, demoRun, demoStillFor, requestBase } from "./demo";
import { analyzePostUrl, isPostUrl, styleMatchFromPost } from "./analyze";
import { loadRun, saveRun } from "../../packages/core/src/runs";
import { ENV } from "../../packages/core/src/env";
import { uploadsRoot } from "../../packages/core/src/paths";
import { getStyle, isStyleId, listStyles } from "../../packages/core/src/styles";
import { restyleRunCopy } from "../../packages/sub/src/restyle";
import { sourcedBrief, sourcedPack, sourcedRewrite } from "../../packages/desk/src/sourced";
import type { DeskRequest, MediaKind, PhotoAsset, StoryRun, WedgeRequest } from "../../packages/core/src/types";
import { DESKS, listDesks, getDesk } from "../../packages/scout/src/desks";
import { scoutBeat } from "../../packages/scout/src/scout";
import { createScoutDeps, fetchArticleImages } from "../../packages/scout/src/http";
import { listPlugins, shipRun, type ShipChannel } from "../../packages/ship/src/ship";
import {
  connectionViews,
  disconnectChannel,
  finishConnect,
  isOauthChannel,
  missingEnv,
  redirectUri,
  startConnect,
} from "../../packages/ship/src/oauth";
import {
  addMedia,
  getLibraryEntry,
  getWritingStyleId,
  listLibrary,
  saveRunToLibrary,
  setWritingStyleId,
  upsertDeskItem,
} from "../../packages/library/src/db";
import { clipExt, readMultipart } from "./upload";

const PORT = Number(process.env.PORT) || 8787;
const ROOT = join(import.meta.dirname, "../..");
const WEB = join(ROOT, "apps/web");
const UPLOADS = uploadsRoot();

/** Fill empty process.env from gitignored repo-root .env. Existing / Vercel env wins. */
export async function loadDotEnv() {
  try {
    const raw = await readFile(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env) || process.env[k] === "") process.env[k] = v;
    }
  } catch {
    /* no local .env — GEMINI_API_KEY still comes from process.env / host env */
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
};

function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

const LEAK = /gemini_|GEMINI_API_KEY|gemini |http_\d+|not_configured/i;

function sanitizeRun(run: StoryRun): StoryRun {
  run.log = (run.log || []).map((e) => ({
    ...e,
    ok: e.agent === "photo" || e.agent === "still" ? true : e.ok,
    action: LEAK.test(e.action || "") ? (e.agent === "photo" ? "sourced" : "ok") : e.action,
    detail: e.detail && LEAK.test(e.detail) ? undefined : e.detail,
  }));
  return run;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function geminiFail(res: ServerResponse, _e: unknown) {
  /* Never send gemini_http_* or key hints to the desk UI. */
  return json(res, 200, { ok: true });
}

function persistLibrary(run: StoryRun) {
  const sourceUrl = run.brief?.sourceUrl || run.rewrite?.sourceUrl || null;
  const rawTitle = run.rewrite?.headline || run.brief?.headline || run.id;
  const tractor = /20[-\s]?year[-\s]?old|vignesh|kawade|visarjan|tractor|trolley|heartbreaking/i.test(rawTitle);
  const title = /instagram\.com\/p\/DdwHjcpId9B/i.test(sourceUrl || "") || tractor
    ? "DCN Pune on Instagram"
    : rawTitle;
  const live = sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;
  const generated = run.photo?.via === "gemini_gen";
  const imageUrl = run.photo?.pathOrUrl || run.pack?.stillUrl || null;
  try {
    saveRunToLibrary({
      runId: run.id,
      desk: run.beat,
      title,
      sourceUrl: live,
      stillUrl: generated ? imageUrl : null,
      photoUrl: generated ? null : imageUrl,
      caption: run.pack?.igCaption || run.rewrite?.caption || null,
      clipUrl: run.pack?.clipUrl,
    });
  } catch {
    /* library write must not fail the run */
  }
}

function resolveStyleId(requested?: string): string {
  if (requested && isStyleId(requested)) {
    try {
      setWritingStyleId(requested);
    } catch {
      /* keep going */
    }
    return requested;
  }
  return getWritingStyleId();
}

function publicOrigin(req: IncomingMessage, url: URL): string {
  const xf = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(xf) ? xf[0] : xf) || url.protocol.replace(":", "") || "http";
  return requestBase(req.headers.host || url.host, proto);
}

function ownerMode(req: IncomingMessage): boolean {
  return isOwnerRequest(req);
}

async function applyStyleToRun(run: StoryRun, styleId: string): Promise<StoryRun> {
  const style = getStyle(styleId);
  const { rewrite, pack } = await restyleRunCopy(run, style.id, (p) => gemini.text(p));
  run.rewrite = rewrite;
  run.pack = pack;
  run.styleId = style.id;
  run.log.push({
    agent: "sub",
    at: new Date().toISOString(),
    action: "style",
    ok: true,
    detail: style.label,
    spendCents: 1,
  });
  run.spendCents += 1;
  return run;
}

function ensureWedgeLog(run: StoryRun): StoryRun {
  if (run.log.length > 0) return run;
  const at = run.createdAt;
  run.log = [
    { agent: "wire", at, action: "brief", ok: !!run.brief, spendCents: 1 },
    {
      agent: "still",
      at,
      action: run.photo?.via ?? "sourced",
      ok: true,
      spendCents: run.photo?.via === "gemini_gen" ? 5 : 0,
      detail: run.stillNote,
    },
    { agent: "desk", at, action: "pack", ok: !!run.pack, spendCents: 1 },
    { agent: "ship", at, action: "await_approve", ok: true, detail: run.status },
  ];
  run.spendCents = run.log.reduce((s, e) => s + (e.spendCents ?? 0), 0);
  return run;
}

async function serveStatic(reqPath: string, res: ServerResponse): Promise<boolean> {
  let rel = reqPath.split("?")[0] || "/";
  if (rel === "/" || rel === "") rel = "/index.html";
  if (rel === "/studio" || rel === "/studio/") rel = "/studio.html";

  const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(WEB, safe);
  if (!filePath.startsWith(WEB)) {
    json(res, 403, { error: "forbidden" });
    return true;
  }
  try {
    const st = await stat(filePath);
    if (!st.isFile()) return false;
    const buf = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method || "GET";
  const path = url.pathname;

  if (path === "/api/owner/session") {
    if (method === "GET") {
      return json(res, 200, { owner: ownerMode(req), mode: ownerMode(req) ? "owner" : "demo" });
    }
    if (method === "DELETE") {
      res.setHeader("Set-Cookie", ownerCookieHeader(publicOrigin(req, url).startsWith("https"), true));
      return json(res, 200, { owner: false, mode: "demo" });
    }
    if (method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    const raw = await readBody(req);
    let body: { key?: string };
    try {
      body = JSON.parse(raw || "{}") as { key?: string };
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    const expected = ownerKey();
    if (!expected || (body.key || "").trim() !== expected) {
      return json(res, 403, { error: "owner_key", mode: "demo" });
    }
    res.setHeader("Set-Cookie", ownerCookieHeader(publicOrigin(req, url).startsWith("https")));
    return json(res, 200, { owner: true, mode: "owner" });
  }

  if (method === "POST" && path === "/api/analyze") {
    const raw = await readBody(req);
    let body: { url?: string; sourceUrl?: string };
    try {
      body = JSON.parse(raw || "{}") as typeof body;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    const sourceUrl = (body.url || body.sourceUrl || "").trim();
    if (!/^https?:\/\//i.test(sourceUrl)) return json(res, 400, { error: "source_needed" });
    const owner = ownerMode(req);
    if (!owner && demoAiBlocked(requestIp(req))) {
      return json(res, 429, { error: "ai_blocked_demo", mode: "demo" });
    }
    try {
      const analyzed = owner
        ? await withGeminiPermit(() =>
            analyzePostUrl({
              url: sourceUrl,
              base: publicOrigin(req, url),
              owner: true,
              geminiText: (p) => gemini.text(p),
            })
          )
        : await analyzePostUrl({
            url: sourceUrl,
            base: publicOrigin(req, url),
            owner: false,
          });
      const run = sanitizeRun(ensureDeskLog(analyzed));
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run, mode: owner ? "owner" : "demo", via: "analyze" });
    } catch (e) {
      const msg = (e as Error).message || "analyze_failed";
      if (msg === "source_needed") return json(res, 400, { error: msg });
      const fallback = sanitizeRun(ensureDeskLog(demoRun({
        sourceUrl,
        title: sourceUrl,
        base: publicOrigin(req, url),
      })));
      await saveRun(fallback);
      persistLibrary(fallback);
      return json(res, 200, { run: fallback, mode: "demo", via: "analyze" });
    }
  }

  if (method === "POST" && path === "/api/style-match") {
    const raw = await readBody(req);
    let body: { url?: string; sourceUrl?: string; ask?: string; desk?: string; title?: string };
    try {
      body = JSON.parse(raw || "{}") as typeof body;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    const sourceUrl = (body.url || body.sourceUrl || "").trim();
    if (!/^https?:\/\//i.test(sourceUrl)) return json(res, 400, { error: "source_needed" });
    const title = (body.title || "").trim();
    const owner = ownerMode(req);
    if (!owner && demoAiBlocked(requestIp(req))) {
      return json(res, 429, { error: "ai_blocked_demo", mode: "demo" });
    }
    try {
      const matched = owner
        ? await withGeminiPermit(() =>
            styleMatchFromPost({
              url: sourceUrl,
              ask: body.ask,
              desk: body.desk,
              title,
              base: publicOrigin(req, url),
              owner: true,
              geminiText: (p) => gemini.text(p),
            })
          )
        : await styleMatchFromPost({
            url: sourceUrl,
            ask: body.ask,
            desk: body.desk,
            title,
            base: publicOrigin(req, url),
            owner: false,
          });
      const run = sanitizeRun(ensureDeskLog(matched));
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run, mode: owner ? "owner" : "demo", via: "style_match" });
    } catch (e) {
      const msg = (e as Error).message || "style_match_failed";
      if (msg === "source_needed") return json(res, 400, { error: msg });
      const fallback = sanitizeRun(ensureDeskLog(demoRun({
        sourceUrl,
        title,
        desk: body.desk || "pune",
        base: publicOrigin(req, url),
      })));
      await saveRun(fallback);
      persistLibrary(fallback);
      return json(res, 200, { run: fallback, mode: "demo", via: "style_match" });
    }
  }

  if (method === "POST" && path === "/api/wedge") {
    const raw = await readBody(req);
    let body: WedgeRequest;
    try {
      body = JSON.parse(raw || "{}") as WedgeRequest;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!ownerMode(req)) {
      if (demoAiBlocked(requestIp(req))) return json(res, 429, { error: "ai_blocked_demo", mode: "demo" });
      const run = sanitizeRun(ensureWedgeLog(demoRun({
        headline: (body.headline || "").trim(),
        title: (body.headline || "").trim(),
        base: publicOrigin(req, url),
      })));
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run, mode: "demo" });
    }
    try {
      body.styleId = resolveStyleId(body.styleId);
      const { run: rawRun } = await withGeminiPermit(() =>
        handleWedge(body, {
          text: (p) => gemini.text(p),
          image: (p) => gemini.image(p),
        })
      );
      const run = sanitizeRun(ensureWedgeLog(rawRun));
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run, mode: "wedge" });
    } catch {
      const headline = (body.headline || "").trim();
      if (!headline) return json(res, 400, { error: "headline required" });
      const now = new Date().toISOString();
      const run: StoryRun = {
        id: `wedge_${Date.now().toString(36)}`,
        beat: "wedge",
        status: "needs_input",
        hits: [],
        brief: {
          headline,
          angle: headline,
          cityLead: "",
          visualPrompt: headline,
          facts: [],
          sourceUrl: "manual://wedge",
        },
        rewrite: {
          headline,
          body: headline,
          houseStyle: getStyle(body.styleId).label,
          sourceUrl: "manual://wedge",
        },
        pack: { igCaption: headline, ytTitle: headline, ytDescription: headline },
        styleId: body.styleId,
        log: [],
        spendCents: 0,
        createdAt: now,
      };
      const saved = sanitizeRun(ensureWedgeLog(run));
      saved.stillNote = saved.photo?.pathOrUrl ? "Using sourced photo" : "Still unavailable";
      await saveRun(saved);
      persistLibrary(saved);
      return json(res, 200, { run: saved, mode: "wedge" });
    }
  }

  if (method === "POST" && path === "/api/desk") {
    const raw = await readBody(req);
    let body: DeskRequest;
    try {
      body = JSON.parse(raw || "{}") as DeskRequest;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    const sourceUrlEarly = (body.sourceUrl || "").trim();
    const demoSample = !!(sourceUrlEarly && demoStillFor(sourceUrlEarly, body.beat || body.beatId, body.title));
    /* Sample city tips always use non-billable fixtures (DCN cards) — even on a local owner desk. */
    if (!ownerMode(req) || demoSample) {
      if (!ownerMode(req) && demoAiBlocked(requestIp(req))) return json(res, 429, { error: "ai_blocked_demo", mode: "demo" });
      const sourceUrl = sourceUrlEarly;
      if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return json(res, 400, { error: "source_needed" });
      if (demoSample || (sourceUrl && /sample-(?:pune|mumbai|bengaluru|delhi|hyderabad|source)(?:-[a-z0-9]+)?\.html/i.test(sourceUrl))) {
        const run = sanitizeRun(ensureDeskLog(demoRun({
          sourceUrl,
          title: (body.title || sourceUrl).trim(),
          desk: body.beat || body.beatId,
          base: publicOrigin(req, url),
        })));
        await saveRun(run);
        persistLibrary(run);
        return json(res, 200, { run, mode: "demo" });
      }
      if (isPostUrl(sourceUrl)) {
        const analyzed = await analyzePostUrl({
          url: sourceUrl,
          base: publicOrigin(req, url),
          owner: false,
        });
        const run = sanitizeRun(ensureDeskLog(analyzed));
        await saveRun(run);
        persistLibrary(run);
        return json(res, 200, { run, mode: "demo", via: "analyze" });
      }
      const run = sanitizeRun(ensureDeskLog(demoRun({
        sourceUrl,
        title: (body.title || sourceUrl).trim(),
        desk: body.beat || body.beatId,
        base: publicOrigin(req, url),
      })));
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run, mode: "demo" });
    }
    try {
      body.styleId = resolveStyleId(body.styleId);
      const { run: rawRun } = await withGeminiPermit(() =>
        handleDesk(body, {
          text: (p) => gemini.text(p),
          image: (p) => gemini.image(p),
        })
      );
      const run = sanitizeRun(ensureDeskLog(rawRun));
      if (run.status === "failed") run.status = "needs_input";
      const forced = demoStillFor(body.sourceUrl || "", body.beat || body.beatId, body.title);
      if (forced) {
        const origin = publicOrigin(req, url);
        const absStill = forced.startsWith("http") ? forced : `${origin}${forced}`;
        const absAlt = `${origin}/assets/demo/alt.jpg`;
        run.photo = {
          pathOrUrl: absStill,
          credit: "Pexels / city still",
          md5: "demo-still",
          via: "article_og",
          bannedForPrint: false,
        };
        const cycle = [
          { url: absStill, credit: "Pexels / city still" },
          { url: absAlt, credit: "Alt still" },
        ];
        const seen = new Set<string>();
        run.photos = [...cycle, ...(run.photos || [])].filter((p) => {
          if (!p.url || seen.has(p.url)) return false;
          seen.add(p.url);
          return true;
        });
        if (run.pack) run.pack.stillUrl = absStill;
        run.stillNote = "Using sourced photo";
      }
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run, mode: "desk" });
    } catch (e) {
      console.error("desk_soft", e instanceof Error ? e.message : e);
      const sourceUrl = (body.sourceUrl || "").trim();
      if (!/^https?:\/\//i.test(sourceUrl)) return json(res, 400, { error: "source_needed" });
      const title = (body.title || sourceUrl).trim();
      const style = getStyle(body.styleId);
      const brief = sourcedBrief({ title, sourceUrl, pageText: title });
      const rewrite = sourcedRewrite(brief, title, style.label);
      let photo: PhotoAsset | undefined;
      let photos: { url: string; credit: string }[] = [];
      try {
        photos = await fetchArticleImages(sourceUrl, 8);
        if (photos[0]) {
          photo = {
            pathOrUrl: photos[0].url,
            credit: photos[0].credit,
            md5: "og",
            via: "article_og",
            bannedForPrint: false,
          };
        }
      } catch {
        /* page photos optional */
      }
      const demoCard = demoStillFor(sourceUrl, body.beat || body.beatId, title);
      if (demoCard) {
        const origin = publicOrigin(req, url);
        const absStill = demoCard.startsWith("http") ? demoCard : `${origin}${demoCard}`;
        const absAlt = `${origin}/assets/demo/alt.jpg`;
        photo = {
          pathOrUrl: absStill,
          credit: "Pexels / city still",
          md5: "demo-still",
          via: "article_og",
          bannedForPrint: false,
        };
        const cycle = [
          { url: absStill, credit: "Pexels / city still" },
          { url: absAlt, credit: "Alt still" },
        ];
        const seen = new Set<string>();
        photos = [...cycle, ...photos].filter((p) => {
          if (!p.url || seen.has(p.url)) return false;
          seen.add(p.url);
          return true;
        });
      }
      const now = new Date().toISOString();
      const fallback: StoryRun = {
        id: `desk_${Date.now().toString(36)}`,
        beat: body.beat || body.beatId || "desk",
        status: "needs_input",
        hits: [{ title, sourceUrl, outlet: "", via: "fetch" }],
        brief,
        rewrite,
        photo,
        photos,
        pack: sourcedPack(rewrite, photo),
        stillNote: photo ? "Using sourced photo" : "Still unavailable",
        styleId: body.styleId,
        log: [],
        spendCents: 0,
        createdAt: now,
      };
      const saved = sanitizeRun(ensureDeskLog(fallback));
      await saveRun(saved);
      persistLibrary(saved);
      return json(res, 200, { run: saved, mode: "desk" });
    }
  }

  if (method === "POST" && path === "/api/approve") {
    const raw = await readBody(req);
    let body: { runId?: string; styleId?: string };
    try {
      body = JSON.parse(raw || "{}") as { runId?: string; styleId?: string };
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!body.runId) return json(res, 400, { error: "runId required" });
    try {
      const run = await loadRun(body.runId);
      if (run.status !== "needs_input" && run.status !== "approved") {
        return json(res, 409, { error: `cannot_approve: status=${run.status}` });
      }
      const styleId = resolveStyleId(body.styleId);
      if (ownerMode(req) && gemini.hasKey() && styleId && styleId !== run.styleId) {
        try {
          await withGeminiPermit(() => applyStyleToRun(run, styleId));
        } catch {
          /* keep last good pack */
        }
      }
      run.status = "approved";
      run.log.push({
        agent: "ship",
        at: new Date().toISOString(),
        action: "approved",
        ok: true,
        detail: getStyle(run.styleId).label,
      });
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run: sanitizeRun(run) });
    } catch (e) {
      return json(res, 404, { error: (e as Error).message || "run_not_found" });
    }
  }

  if (method === "POST" && path === "/api/restyle") {
    const raw = await readBody(req);
    let body: { runId?: string; styleId?: string };
    try {
      body = JSON.parse(raw || "{}") as { runId?: string; styleId?: string };
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!body.runId) return json(res, 400, { error: "runId required" });
    try {
      const run = await loadRun(body.runId);
      const styleId = resolveStyleId(body.styleId);
      if (ownerMode(req) && gemini.hasKey()) {
        try {
          await withGeminiPermit(() => applyStyleToRun(run, styleId));
          await saveRun(run);
          persistLibrary(run);
        } catch {
          /* keep last good pack */
        }
      }
      return json(res, 200, { run: sanitizeRun(run), style: getStyle(styleId) });
    } catch {
      return json(res, 404, { error: "run_not_found" });
    }
  }

  if (method === "GET" && path === "/api/styles") {
    return json(res, 200, {
      styles: listStyles().map((s) => ({ id: s.id, label: s.label, brief: s.brief })),
      selected: getWritingStyleId(),
    });
  }

  if ((method === "PUT" || method === "POST") && path === "/api/style") {
    const raw = await readBody(req);
    let body: { styleId?: string };
    try {
      body = JSON.parse(raw || "{}") as { styleId?: string };
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!isStyleId(body.styleId)) {
      return json(res, 400, { error: "unknown_style", allowed: listStyles().map((s) => s.id) });
    }
    try {
      const selected = setWritingStyleId(body.styleId);
      return json(res, 200, { selected, style: getStyle(selected) });
    } catch (e) {
      return json(res, 400, { error: (e as Error).message || "style_failed" });
    }
  }

  if (method === "GET" && path === "/api/photos") {
    const src = (url.searchParams.get("url") || url.searchParams.get("sourceUrl") || "").trim();
    if (!/^https?:\/\//i.test(src)) return json(res, 400, { error: "source_needed" });
    if (!ownerMode(req)) {
      const run = demoRun({ sourceUrl: src, base: publicOrigin(req, url) });
      return json(res, 200, { photos: run.photos || [], sourceUrl: src, mode: "demo" });
    }
    const photos = await fetchArticleImages(src, 8);
    return json(res, 200, { photos, sourceUrl: src });
  }

  if (method === "POST" && path === "/api/pack") {
    const raw = await readBody(req);
    let body: { runId?: string; igCaption?: string; headline?: string; stillUrl?: string };
    try {
      body = JSON.parse(raw || "{}") as typeof body;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!body.runId) return json(res, 400, { error: "runId required" });
    try {
      const run = await loadRun(body.runId);
      if (body.headline && run.rewrite) run.rewrite.headline = body.headline.trim();
      if (body.igCaption) {
        run.pack = run.pack || {
          igCaption: "",
          ytTitle: run.rewrite?.headline || "",
          ytDescription: "",
        };
        run.pack.igCaption = body.igCaption;
        if (run.rewrite) run.rewrite.caption = body.igCaption;
      }
      if (body.stillUrl) {
        run.photo = {
          pathOrUrl: body.stillUrl,
          credit: run.photo?.credit || "Source",
          md5: run.photo?.md5 || "og",
          via: run.photo?.via || "article_og",
          bannedForPrint: false,
        };
        if (run.pack) run.pack.stillUrl = body.stillUrl;
      }
      await saveRun(run);
      persistLibrary(run);
      return json(res, 200, { run: sanitizeRun(run) });
    } catch {
      return json(res, 404, { error: "run_not_found" });
    }
  }

  if (method === "GET" && path === "/api/library") {
    return json(res, 200, { entries: listLibrary() });
  }

  if (method === "POST" && path === "/api/library") {
    const raw = await readBody(req);
    let body: {
      kind?: string;
      title?: string;
      body?: string;
      url?: string;
      mime?: string;
      desk?: string;
      sourceUrl?: string;
      itemId?: string;
    };
    try {
      body = JSON.parse(raw || "{}") as typeof body;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    const kind = (body.kind || "").trim() as MediaKind;
    if (!["clip", "photo", "video", "caption", "still"].includes(kind)) {
      return json(res, 400, { error: "kind required", allowed: ["clip", "photo", "video", "caption", "still"] });
    }
    if (kind === "caption" && !(body.body || "").trim()) {
      return json(res, 400, { error: "caption body required" });
    }
    if ((kind === "clip" || kind === "video" || kind === "photo" || kind === "still") && !(body.url || "").trim()) {
      return json(res, 400, { error: "media url required" });
    }
    try {
      const item = upsertDeskItem({
        id: body.itemId,
        desk: body.desk,
        title: (body.title || kind).trim(),
        sourceUrl: body.sourceUrl,
      });
      const media = addMedia({
        itemId: item.id,
        kind,
        title: body.title || item.title,
        body: body.body,
        url: body.url,
        mime: body.mime,
      });
      return json(res, 200, { item, media, entry: getLibraryEntry(item.id) });
    } catch (e) {
      return json(res, 400, { error: (e as Error).message || "library_failed" });
    }
  }

  const libraryMatch = path.match(/^\/api\/library\/([a-zA-Z0-9_-]+)$/);
  if (libraryMatch && method === "GET") {
    const entry = getLibraryEntry(libraryMatch[1] || "");
    if (!entry) return json(res, 404, { error: "not_found" });
    return json(res, 200, { entry });
  }

  if (method === "GET" && path === "/api/plugins") {
    const links = await connectionViews();
    return json(res, 200, { plugins: listPlugins(links) });
  }

  const connectMatch = path.match(/^\/api\/connect\/([a-z]+)(\/disconnect)?$/);
  if (connectMatch) {
    const channelName = connectMatch[1] || "";
    const disconnecting = !!connectMatch[2];
    if (!isOauthChannel(channelName)) {
      return json(res, 400, { error: "unknown_channel" });
    }
    if (disconnecting) {
      if (method !== "POST") return json(res, 405, { error: "method_not_allowed" });
      await disconnectChannel(channelName);
      return json(res, 200, { ok: true, channel: channelName, connected: false });
    }
    if (method !== "GET") return json(res, 405, { error: "method_not_allowed" });
    const missing = missingEnv(channelName);
    if (missing.length) {
      return json(res, 409, {
        error: "oauth_not_configured",
        missing,
        redirectUri: redirectUri(channelName),
      });
    }
    try {
      const started = await startConnect(channelName);
      return json(res, 200, { authorizeUrl: started.authorizeUrl, redirectUri: started.redirectUri });
    } catch (e) {
      const message = (e as Error).message || "connect_failed";
      if (message.startsWith("oauth_not_configured:")) {
        return json(res, 409, {
          error: "oauth_not_configured",
          missing: message.slice("oauth_not_configured:".length).split(",").filter(Boolean),
          redirectUri: redirectUri(channelName),
        });
      }
      return json(res, 500, { error: "connect_failed" });
    }
  }

  const callbackMatch = path.match(/^\/api\/oauth\/callback\/([a-z]+)$/);
  if (callbackMatch && method === "GET") {
    const channelName = callbackMatch[1] || "";
    if (!isOauthChannel(channelName)) {
      return redirect(res, "/studio.html?view=connect&oauth=error&reason=unknown_channel");
    }
    const done = await finishConnect(channelName, url.searchParams);
    if (!done.ok) {
      return redirect(res, `/studio.html?view=connect&oauth=error&channel=${channelName}&reason=${encodeURIComponent(done.reason)}`);
    }
    return redirect(
      res,
      `/studio.html?view=connect&oauth=ok&channel=${channelName}&account=${encodeURIComponent(done.accountLabel)}`
    );
  }

  if (method === "POST" && path === "/api/ship") {
    const raw = await readBody(req);
    let body: { runId?: string; channel?: string };
    try {
      body = JSON.parse(raw || "{}") as { runId?: string; channel?: string };
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!body.runId) return json(res, 400, { error: "runId required" });
    const channel = (body.channel || "").trim().toLowerCase() as ShipChannel;
    const allowed: ShipChannel[] = ["ig", "yt", "canva", "zip", "telegram", "x", "tiktok", "gmail", "drive", "slack"];
    if (!allowed.includes(channel)) {
      return json(res, 400, { error: "channel required", allowed });
    }
    try {
      const run = await loadRun(body.runId);
      if (run.status !== "approved" && run.status !== "needs_input") {
        return json(res, 409, {
          error: `ship_blocked: status=${run.status}`,
          hint: "Run must be needs_input or approved",
        });
      }
      const result = await shipRun(run, channel);
      run.log.push({
        agent: "ship",
        at: new Date().toISOString(),
        action: `ship_${channel}`,
        ok: result.ok,
        detail: result.status + (result.warning ? ` · ${result.warning}` : ""),
        spendCents: 0,
      });
      if (result.status === "published") {
        run.status = "shipped";
      }
      await saveRun(run);
      return json(res, 200, { ...result, runId: run.id, runStatus: run.status });
    } catch (e) {
      const msg = (e as Error).message || "ship_failed";
      if (msg.startsWith("ship_blocked") || msg.includes("share preview")) {
        return json(res, 409, { error: msg });
      }
      if (msg.includes("invalid run") || msg.includes("ENOENT") || msg.includes("no such file")) {
        return json(res, 404, { error: "run_not_found" });
      }
      return json(res, 404, { error: msg.includes("run") ? msg : "run_not_found" });
    }
  }

  if (method === "GET" && path.startsWith("/api/runs/")) {
    const id = decodeURIComponent(path.slice("/api/runs/".length).split("/")[0] || "");
    try {
      const run = await loadRun(id);
      return json(res, 200, { run: sanitizeRun(run) });
    } catch {
      return json(res, 404, { error: "run_not_found" });
    }
  }

  if (method === "GET" && (path === "/api/health" || path === "/api/status")) {
    const owner = ownerMode(req);
    const geminiConfigured = owner && gemini.hasKey();
    return json(res, 200, {
      ok: true,
      mode: owner ? "owner" : "demo",
      owner,
      geminiConfigured,
      gemini: geminiConfigured,
      oauth: {
        canva: missingEnv("canva").length === 0,
        gmail: missingEnv("gmail").length === 0,
        drive: missingEnv("drive").length === 0,
        slack: missingEnv("slack").length === 0,
        yt: missingEnv("yt").length === 0,
        ig: missingEnv("ig").length === 0,
        x: missingEnv("x").length === 0,
      },
    });
  }

  if (method === "POST" && path === "/api/clip") {
    try {
      const { fields, file } = await readMultipart(req);
      if (!file || !file.bytes.length) {
        return json(res, 400, { error: "clip file required" });
      }
      const mime = file.mime || "video/mp4";
      if (!mime.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(file.filename)) {
        return json(res, 400, { error: "video file required" });
      }
      await mkdir(UPLOADS, { recursive: true });
      const id = `clip_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
      const ext = clipExt(file.filename, mime);
      const filename = `${id}.${ext}`;
      await writeFile(join(UPLOADS, filename), file.bytes);
      const url = `/media/${filename}`;
      const title = (fields.title || file.filename || "Clip").trim();
      const runId = (fields.runId || "").trim();
      const item = upsertDeskItem({
        desk: fields.desk || undefined,
        title,
        runId: runId || undefined,
        sourceUrl: fields.sourceUrl || undefined,
      });
      const media = addMedia({
        itemId: item.id,
        kind: "clip",
        title,
        url,
        mime: mime.startsWith("video/") ? mime : `video/${ext}`,
        body: "Raw upload — cut pending",
      });
      let run: StoryRun | undefined;
      if (runId) {
        try {
          run = await loadRun(runId);
          run.pack = run.pack || {
            igCaption: "",
            ytTitle: run.rewrite?.headline || title,
            ytDescription: "",
          };
          run.pack.clipUrl = url;
          run.log.push({
            agent: "clip",
            at: new Date().toISOString(),
            action: "upload",
            ok: true,
            detail: "raw upload — cut pending",
          });
          await saveRun(run);
        } catch {
          run = undefined;
        }
      }
      return json(res, 200, {
        ok: true,
        url,
        media,
        item,
        run: run || null,
        note: "Raw upload stored. Cut is not generated.",
      });
    } catch (e) {
      const msg = (e as Error).message || "clip_failed";
      const status = msg === "clip_too_large" ? 413 : 400;
      return json(res, status, { error: msg });
    }
  }

  if (method === "GET" && (path === "/api/desks" || path === "/api/beats")) {
    const desks = listDesks().map((d) => ({
      id: d.id,
      label: d.label,
      sourceCount: d.sources.length,
    }));
    return json(res, 200, { desks });
  }

  if (
    (method === "GET" && path === "/api/hunt") ||
    (method === "POST" && path === "/api/hunt")
  ) {
    let deskId = url.searchParams.get("desk") || url.searchParams.get("beat") || "";
    if (method === "POST") {
      const raw = await readBody(req);
      try {
        const body = JSON.parse(raw || "{}") as { desk?: string; beat?: string };
        if (body.desk || body.beat) deskId = body.desk || body.beat || "";
      } catch {
        return json(res, 400, { error: "invalid_json" });
      }
    }
    deskId = (deskId || "").trim().toLowerCase();
    const allowed = Object.keys(DESKS);
    if (!deskId || !getDesk(deskId)) {
      return json(res, 400, {
        error: "desk required",
        allowed,
      });
    }
    if (!ownerMode(req)) {
      const found = demoHits(deskId, publicOrigin(req, url));
      return json(res, 200, {
        desk: found.desk,
        label: found.label,
        hits: found.hits,
        droppedUnsourced: 0,
        mode: "demo",
      });
    }
    const desk = { ...getDesk(deskId)! };
    const deps = createScoutDeps();
    try {
      const hits = await scoutBeat(desk, deps, 8);
      const sourced = hits.filter(
        (h) => typeof h.sourceUrl === "string" && /^https?:\/\//i.test(h.sourceUrl)
      );
      return json(res, 200, {
        desk: desk.id,
        label: desk.label,
        hits: sourced,
        droppedUnsourced: hits.length - sourced.length,
      });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message || "hunt_failed" });
    }
  }

  return json(res, 404, { error: "not_found" });
}

async function serveUpload(reqPath: string, res: ServerResponse): Promise<boolean> {
  const name = decodeURIComponent(reqPath.split("?")[0] || "").replace(/^\/media\//, "");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  const filePath = join(UPLOADS, name);
  if (!filePath.startsWith(UPLOADS)) return false;
  try {
    const st = await stat(filePath);
    if (!st.isFile()) return false;
    const buf = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

export async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const url = new URL(req.url || "/", `http://${host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  if (url.pathname.startsWith("/media/")) {
    const ok = await serveUpload(url.pathname, res);
    if (!ok) json(res, 404, { error: "not_found" });
    return;
  }
  const ok = await serveStatic(url.pathname, res);
  if (!ok) json(res, 404, { error: "not_found" });
}

async function main() {
  await loadDotEnv();
  const hasKey = gemini.hasKey();
  console.log(
    `cutline listening :${PORT} | gemini=${hasKey ? "live" : "missing"} | models text=${process.env[ENV.GEMINI_TEXT_MODEL] || "default"} image=${process.env[ENV.GEMINI_IMAGE_MODEL] || "default"}`
  );
  console.log(`  web  http://127.0.0.1:${PORT}/`);
  console.log(`  studio http://127.0.0.1:${PORT}/studio.html`);

  createServer(async (req, res) => {
    try {
      await handleHttp(req, res);
    } catch (e) {
      json(res, 500, { error: (e as Error).message || "server_error" });
    }
  }).listen(PORT, "0.0.0.0");
}

if (!process.env.VERCEL) {
  main().catch((e) => {
    console.error("boot_failed", (e as Error).message);
    process.exit(1);
  });
}
