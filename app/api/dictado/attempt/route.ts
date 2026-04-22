import { NextRequest, NextResponse } from "next/server";
import { getQuizDatabase } from "@/lib/db";
import { isSupportedScope } from "@/lib/audio-urls";

interface AttemptPayload {
  scope: string;
  simplified: string;
  pinyin_ok: boolean;
  hanzi_ok: boolean;
  self_grade?: string | null;
  pinyin_input?: string | null;
  response_ms?: number | null;
}

export async function POST(req: NextRequest) {
  let body: AttemptPayload;
  try {
    body = (await req.json()) as AttemptPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (
    typeof body.scope !== "string" ||
    typeof body.simplified !== "string" ||
    typeof body.pinyin_ok !== "boolean" ||
    typeof body.hanzi_ok !== "boolean"
  ) {
    return NextResponse.json({ error: "payload incompleto" }, { status: 400 });
  }
  if (!isSupportedScope(body.scope)) {
    return NextResponse.json({ error: `scope no soportado: ${body.scope}` }, { status: 400 });
  }

  const db = getQuizDatabase();
  try {
    const stmt = db.prepare(
      `INSERT INTO dictado_attempts
        (scope, simplified, attempted_at, pinyin_ok, hanzi_ok, self_grade, pinyin_input, response_ms)
        VALUES (@scope, @simplified, @attempted_at, @pinyin_ok, @hanzi_ok, @self_grade, @pinyin_input, @response_ms)`
    );
    const info = stmt.run({
      scope: body.scope,
      simplified: body.simplified,
      attempted_at: Date.now(),
      pinyin_ok: body.pinyin_ok ? 1 : 0,
      hanzi_ok: body.hanzi_ok ? 1 : 0,
      self_grade: body.self_grade ?? null,
      pinyin_input: body.pinyin_input ?? null,
      response_ms: body.response_ms ?? null,
    });
    return NextResponse.json({ id: info.lastInsertRowid });
  } finally {
    db.close();
  }
}
