import { NextRequest, NextResponse } from "next/server";
import { getQuizDatabase } from "@/lib/db";

// POST — save exam snapshot
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, scope, total_cards, known, partial, unknown } = body;

  if (!scope || total_cards == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const score_pct =
    total_cards > 0
      ? Math.round(((known + partial * 0.5) / total_cards) * 100 * 10) / 10
      : 0;

  const db = getQuizDatabase();
  try {
    const result = db
      .prepare(
        `INSERT INTO exam_snapshots (name, scope, total_cards, known, partial, unknown, score_pct)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name || `Examen ${new Date().toLocaleDateString("es-MX")}`,
        scope,
        total_cards,
        known || 0,
        partial || 0,
        unknown || 0,
        score_pct
      );

    return NextResponse.json({
      id: result.lastInsertRowid,
      score_pct,
      status: "saved",
    });
  } finally {
    db.close();
  }
}

// GET — list exam snapshots
export async function GET() {
  const db = getQuizDatabase();
  try {
    const exams = db
      .prepare(`SELECT * FROM exam_snapshots ORDER BY created_at DESC`)
      .all();
    return NextResponse.json({ exams });
  } finally {
    db.close();
  }
}
