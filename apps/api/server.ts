/**
 * Cutline Phase A HTTP — Mode A wedge only (no Scout on /api/wedge).
 * Port 8787. Serves apps/web + API. Never logs secrets.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { handleWedge } from "./wedge";
import { gemini } from "../../packages/core/src/gemini";
import { loadRun, saveRun } from "../../packages/core/src/runs";
import { ENV } from "../../packages/core/src/env";
import type { StoryRun, WedgeRequest } from "../../packages/core/src/types";
import { BEATS, listBeats, getBeat } from "../../packages/scout/src/beats";
import { scoutBeat } from "../../packages/scout/src/scout";
import { createScoutDeps, hasTinyfishKey } from "../../packages/scout/src/http";
import { listPlugins, shipRun, type ShipChannel } from "../../packages/ship/src/ship";

const PORT = Number(process.env.PORT) || 8787;
const ROOT = join(import.meta.dirname, "../..");
const WEB = join(ROOT, "apps/web");

/** Load .env if present — values never printed. */
async function loadDotEnv() {
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
    /* no .env — stub mode OK */
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
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Enrich wedge run.log so studio tool pane has agent actions. */
function ensureWedgeLog(run: StoryRun): StoryRun {
  if (run.log.length > 0) return run;
  const at = run.createdAt;
  run.log = [
    { agent: "wire", at, action: "brief", ok: !!run.brief, spendCents: 1 },
    {
      agent: "still",
      at,
      action: run.photo?.via ?? "none",
      ok: !!run.photo,
      spendCents: run.photo?.via === "gemini_gen" ? 5 : 0,
      detail: run.photo?.bannedForPrint ? "bannedForPrint" : undefined,
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

  // Map /assets/* → apps/web/assets
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

  if (method === "POST" && path === "/api/wedge") {
    const raw = await readBody(req);
    let body: WedgeRequest;
    try {
      body = JSON.parse(raw || "{}") as WedgeRequest;
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    try {
      const { run: rawRun } = await handleWedge(body, {
        text: (p) => gemini.text(p),
        image: (p) => gemini.image(p),
      });
      const run = ensureWedgeLog(rawRun);
      await saveRun(run);
      return json(res, 200, { run, stub: !gemini.hasKey() });
    } catch (e) {
      return json(res, 400, { error: (e as Error).message || "wedge_failed" });
    }
  }

  if (method === "POST" && path === "/api/approve") {
    const raw = await readBody(req);
    let body: { runId?: string };
    try {
      body = JSON.parse(raw || "{}") as { runId?: string };
    } catch {
      return json(res, 400, { error: "invalid_json" });
    }
    if (!body.runId) return json(res, 400, { error: "runId required" });
    try {
      const run = await loadRun(body.runId);
      if (run.status !== "needs_input" && run.status !== "approved") {
        return json(res, 409, { error: `cannot_approve: status=${run.status}` });
      }
      run.status = "approved";
      run.log.push({
        agent: "ship",
        at: new Date().toISOString(),
        action: "approved",
        ok: true,
      });
      await saveRun(run);
      return json(res, 200, { run });
    } catch (e) {
      return json(res, 404, { error: (e as Error).message || "run_not_found" });
    }
  }


  if (method === "GET" && path === "/api/plugins") {
    return json(res, 200, { plugins: listPlugins() });
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
    const allowed: ShipChannel[] = ["ig", "yt", "canva", "zip", "telegram", "x", "tiktok"];
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
      // Log ship attempt — never claim published for OAuth stubs
      run.log.push({
        agent: "ship",
        at: new Date().toISOString(),
        action: `ship_${channel}`,
        ok: result.ok,
        detail: result.status + (result.warning ? ` · ${result.warning}` : ""),
        spendCents: 0,
      });
      if (channel === "zip" && result.status === "downloaded") {
        // ZIP is a real local export; do not flip to shipped (OAuth not done)
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
      return json(res, 200, { run });
    } catch {
      return json(res, 404, { error: "run_not_found" });
    }
  }



  if (method === "GET" && path === "/api/health") {
    return json(res, 200, {
      ok: true,
      gemini: gemini.hasKey(),
      tinyfish: hasTinyfishKey(),
      // names only — never values
    });
  }

  if (method === "GET" && path === "/api/beats") {
    const beats = listBeats().map((b) => ({
      id: b.id,
      tinyfishQuery: b.tinyfishQuery || null,
      feedCount: b.rssFeeds.length,
      location: b.location || null,
      keywordCount: b.keywords.length,
      recencyMinutes: b.recencyMinutes ?? null,
    }));
    return json(res, 200, { beats, stubTinyfish: !hasTinyfishKey() });
  }

  if (
    (method === "GET" && path === "/api/hunt") ||
    (method === "POST" && path === "/api/hunt")
  ) {
    let beatId = url.searchParams.get("beat") || "";
    let qOverride = url.searchParams.get("q") || undefined;
    if (method === "POST") {
      const raw = await readBody(req);
      try {
        const body = JSON.parse(raw || "{}") as { beat?: string; query?: string; q?: string };
        if (body.beat) beatId = body.beat;
        if (body.query || body.q) qOverride = body.query || body.q;
      } catch {
        return json(res, 400, { error: "invalid_json" });
      }
    }
    beatId = (beatId || "").trim().toLowerCase();
    const allowed = Object.keys(BEATS);
    if (!beatId || !getBeat(beatId)) {
      return json(res, 400, {
        error: "beat required",
        allowed,
      });
    }
    const beat = { ...getBeat(beatId)! };
    if (qOverride?.trim()) beat.tinyfishQuery = qOverride.trim();
    const deps = createScoutDeps({
      location: beat.location,
      recencyMinutes: beat.recencyMinutes,
      queryOverride: qOverride?.trim() || undefined,
    });
    try {
      const hits = await scoutBeat(beat, deps, 8);
      // Product rule: every Wire/Hunt hit MUST have a real openable sourceUrl
      const sourced = hits.filter(
        (h) => typeof h.sourceUrl === "string" && /^https?:\/\//i.test(h.sourceUrl)
      );
      const viaCountsSourced = { rss: 0, tinyfish: 0, outlet_fetch: 0, manual: 0 };
      for (const h of sourced) {
        if (h.via in viaCountsSourced) viaCountsSourced[h.via as keyof typeof viaCountsSourced]++;
      }
      return json(res, 200, {
        beat: beat.id,
        query: beat.tinyfishQuery || null,
        hits: sourced,
        viaCounts: viaCountsSourced,
        stubTinyfish: !hasTinyfishKey(),
        truthLane: "live URL required · no AI-invented news · Browser holds the source",
        droppedUnsourced: hits.length - sourced.length,
      });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message || "hunt_failed" });
    }
  }

  return json(res, 404, { error: "not_found" });
}

async function main() {
  await loadDotEnv();
  const hasKey = gemini.hasKey();
  // Mentions env NAMES only — never values
  const tf = hasTinyfishKey();
  console.log(
    `cutline listening :${PORT} | gemini=${hasKey ? "live" : "stub"} | tinyfish=${tf ? "live" : "stub"} | models text=${process.env[ENV.GEMINI_TEXT_MODEL] || "default"} image=${process.env[ENV.GEMINI_IMAGE_MODEL] || "default"}`
  );
  console.log(`  web  http://127.0.0.1:${PORT}/`);
  console.log(`  studio http://127.0.0.1:${PORT}/studio.html`);

  createServer(async (req, res) => {
    try {
      const host = req.headers.host || `127.0.0.1:${PORT}`;
      const url = new URL(req.url || "/", `http://${host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }
      const ok = await serveStatic(url.pathname, res);
      if (!ok) json(res, 404, { error: "not_found" });
    } catch (e) {
      json(res, 500, { error: (e as Error).message || "server_error" });
    }
  }).listen(PORT, "0.0.0.0");
}

main().catch((e) => {
  console.error("boot_failed", (e as Error).message);
  process.exit(1);
});
