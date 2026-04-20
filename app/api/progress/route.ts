import { NextRequest, NextResponse } from "next/server";
import { getQuizDatabase } from "@/lib/db";
import { calculateNextReview, type ReviewResult, type SrsState } from "@/lib/srs";

// POST — record a review
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { simplified, result, mode, response_ms } = body as {
    simplified: string;
    result: ReviewResult;
    mode: "diagnostic" | "practice" | "exam";
    response_ms?: number;
  };

  if (!simplified || !result || !mode) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = getQuizDatabase();
  try {
    // Log the review
    db.prepare(
      `INSERT INTO review_log (simplified, mode, result, response_ms) VALUES (?, ?, ?, ?)`
    ).run(simplified, mode, result, response_ms ?? null);

    // Get or create card progress
    const existing = db
      .prepare(`SELECT * FROM card_progress WHERE simplified = ?`)
      .get(simplified) as
      | (SrsState & { last_dx: string | null })
      | undefined;

    if (!existing) {
      // First time seeing this card
      const initial: SrsState = {
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review: new Date().toISOString().split("T")[0],
      };
      const next = calculateNextReview(initial, result);

      db.prepare(
        `INSERT INTO card_progress (simplified, ease_factor, interval_days, repetitions, next_review, last_dx)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        simplified,
        next.ease_factor,
        next.interval_days,
        next.repetitions,
        next.next_review,
        result
      );

      return NextResponse.json({ status: "created", next });
    }

    // Update existing
    const current: SrsState = {
      ease_factor: existing.ease_factor,
      interval_days: existing.interval_days,
      repetitions: existing.repetitions,
      next_review: existing.next_review,
    };
    const next = calculateNextReview(current, result);

    db.prepare(
      `UPDATE card_progress
       SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review = ?, last_dx = ?, updated_at = datetime('now')
       WHERE simplified = ?`
    ).run(
      next.ease_factor,
      next.interval_days,
      next.repetitions,
      next.next_review,
      result,
      simplified
    );

    return NextResponse.json({ status: "updated", next });
  } finally {
    db.close();
  }
}

// GET — get cards due for review (SRS practice queue)
export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const db = getQuizDatabase();

  try {
    const today = new Date().toISOString().split("T")[0];
    const due = db
      .prepare(
        `SELECT simplified, ease_factor, interval_days, repetitions, next_review, last_dx
         FROM card_progress
         WHERE next_review <= ?
         ORDER BY next_review ASC, ease_factor ASC
         LIMIT ?`
      )
      .all(today, limit);

    return NextResponse.json({ due, count: due.length });
  } finally {
    db.close();
  }
}
