import { NextResponse } from "next/server";
import { getQuizDatabase } from "@/lib/db";

export async function GET() {
  const db = getQuizDatabase();

  try {
    const today = new Date().toISOString().split("T")[0];

    // Overall progress
    const total = db
      .prepare(`SELECT COUNT(*) as count FROM card_progress`)
      .get() as { count: number };

    const byDx = db
      .prepare(
        `SELECT last_dx, COUNT(*) as count FROM card_progress GROUP BY last_dx`
      )
      .all() as { last_dx: string; count: number }[];

    // Due today
    const dueToday = db
      .prepare(
        `SELECT COUNT(*) as count FROM card_progress WHERE next_review <= ?`
      )
      .get(today) as { count: number };

    // Reviews today
    const reviewsToday = db
      .prepare(
        `SELECT result, COUNT(*) as count FROM review_log WHERE date(created_at) = ? GROUP BY result`
      )
      .all(today) as { result: string; count: number }[];

    // Total reviews all time
    const totalReviews = db
      .prepare(`SELECT COUNT(*) as count FROM review_log`)
      .get() as { count: number };

    // Exam history
    const exams = db
      .prepare(
        `SELECT * FROM exam_snapshots ORDER BY created_at DESC LIMIT 10`
      )
      .all();

    // Streak (consecutive days with reviews)
    const days = db
      .prepare(
        `SELECT DISTINCT date(created_at) as day FROM review_log ORDER BY day DESC LIMIT 60`
      )
      .all() as { day: string }[];

    let streak = 0;
    const todayDate = new Date(today);
    for (let i = 0; i < days.length; i++) {
      const expected = new Date(todayDate);
      expected.setDate(expected.getDate() - i);
      if (days[i].day === expected.toISOString().split("T")[0]) {
        streak++;
      } else {
        break;
      }
    }

    return NextResponse.json({
      total_cards_seen: total.count,
      by_dx: Object.fromEntries(
        byDx.filter((r) => r.last_dx != null).map((r) => [r.last_dx, r.count])
      ),
      due_today: dueToday.count,
      reviews_today: Object.fromEntries(
        reviewsToday.map((r) => [r.result, r.count])
      ),
      total_reviews: totalReviews.count,
      streak,
      exams,
    });
  } finally {
    db.close();
  }
}
