import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

const AUDIO_ROOT = path.resolve(process.cwd(), "../hanziflow-audio/cache");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (!segments || segments.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  // Reject obvious traversal attempts and empty segments before resolving.
  for (const seg of segments) {
    if (!seg || seg.includes("\0") || seg === ".." || seg === ".") {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const joined = path.join(...segments);
  const fullPath = path.resolve(AUDIO_ROOT, joined);

  // Path-traversal guard: fullPath must be inside AUDIO_ROOT.
  if (
    fullPath !== AUDIO_ROOT &&
    !fullPath.startsWith(AUDIO_ROOT + path.sep)
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(fullPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const data = fs.readFileSync(fullPath);
  // Wrap in Uint8Array for BodyInit compatibility.
  const body = new Uint8Array(data);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
