/**
 * One-file multipart reader. No extra deps. Never logs file bodies.
 */
import type { IncomingMessage } from "node:http";

const MAX_BYTES = 40 * 1024 * 1024;

export interface UploadedFile {
  filename: string;
  mime: string;
  bytes: Buffer;
}

export async function readMultipart(
  req: IncomingMessage
): Promise<{ fields: Record<string, string>; file: UploadedFile | null }> {
  const ctype = String(req.headers["content-type"] || "");
  const m = ctype.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = (m?.[1] || m?.[2] || "").trim();
  if (!boundary) throw new Error("multipart_boundary");

  const chunks: Buffer[] = [];
  let size = 0;
  await new Promise<void>((resolve, reject) => {
    req.on("data", (c) => {
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += buf.length;
      if (size > MAX_BYTES) {
        reject(new Error("clip_too_large"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve());
    req.on("error", reject);
  });

  const raw = Buffer.concat(chunks);
  const marker = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: UploadedFile | null = null;

  let offset = 0;
  while (offset < raw.length) {
    const start = raw.indexOf(marker, offset);
    if (start < 0) break;
    offset = start + marker.length;
    if (raw.slice(offset, offset + 2).toString() === "--") break;
    if (raw.slice(offset, offset + 2).toString() === "\r\n") offset += 2;

    const headerEnd = raw.indexOf("\r\n\r\n", offset);
    if (headerEnd < 0) break;
    const headers = raw.slice(offset, headerEnd).toString("utf8");
    offset = headerEnd + 4;

    const next = raw.indexOf(marker, offset);
    const end = next < 0 ? raw.length : next;
    let body = raw.slice(offset, end);
    if (body.length >= 2 && body.slice(-2).toString() === "\r\n") {
      body = body.slice(0, -2);
    }
    offset = end;

    const name = /name="([^"]+)"/i.exec(headers)?.[1] || "";
    const filename = /filename="([^"]*)"/i.exec(headers)?.[1] || "";
    const mime = /Content-Type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() || "application/octet-stream";
    if (filename) {
      file = { filename, mime, bytes: body };
    } else if (name) {
      fields[name] = body.toString("utf8");
    }
  }

  return { fields, file };
}

export function clipExt(filename: string, mime: string): string {
  const fromName = (filename.split(".").pop() || "").toLowerCase();
  if (["mp4", "webm", "mov", "m4v"].includes(fromName)) return fromName;
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  return "mp4";
}
