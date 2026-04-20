/**
 * SM-2 Spaced Repetition Algorithm (simplified for HanziFlow Quiz)
 *
 * Based on SuperMemo 2 by Piotr Woźniak, adapted for 3-grade system:
 *   ☑ known   = grade 5 (perfect response)
 *   ◐ partial = grade 3 (correct but with difficulty)
 *   ☐ unknown = grade 1 (complete failure)
 *
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

export type ReviewResult = "known" | "partial" | "unknown";

export interface SrsState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string; // ISO date string YYYY-MM-DD
}

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Math.max(1, Math.round(days)));
  return d.toISOString().split("T")[0];
}

export function calculateNextReview(
  current: SrsState,
  result: ReviewResult
): SrsState {
  const today = todayStr();
  let { ease_factor, interval_days, repetitions } = current;

  if (result === "unknown") {
    // Reset — card goes back to beginning
    return {
      ease_factor: Math.max(MIN_EASE, ease_factor - 0.2),
      interval_days: 0,
      repetitions: 0,
      next_review: today, // Review again today
    };
  }

  if (result === "partial") {
    // Partial — don't advance much, slight ease penalty
    ease_factor = Math.max(MIN_EASE, ease_factor - 0.15);

    if (repetitions === 0) {
      interval_days = 1;
    } else {
      // Keep current interval or reduce slightly
      interval_days = Math.max(1, interval_days * 0.8);
    }
    repetitions = Math.max(1, repetitions);

    return {
      ease_factor,
      interval_days,
      repetitions,
      next_review: addDays(today, interval_days),
    };
  }

  // result === "known" — advance
  ease_factor = Math.max(MIN_EASE, ease_factor + 0.1);
  repetitions += 1;

  if (repetitions === 1) {
    interval_days = 1;
  } else if (repetitions === 2) {
    interval_days = 3;
  } else {
    interval_days = Math.round(interval_days * ease_factor);
  }

  return {
    ease_factor,
    interval_days,
    repetitions,
    next_review: addDays(today, interval_days),
  };
}

export function getDefaultSrsState(): SrsState {
  return {
    ease_factor: DEFAULT_EASE,
    interval_days: 0,
    repetitions: 0,
    next_review: todayStr(),
  };
}
