import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// HSK vocabulary DB (read-only source)
const HSK_DB_PATH = path.resolve(
  process.cwd(),
  "../HSK-word-list/hanzi-flow-hsk/output/hsk_vocabulary.db"
);

// Quiz progress DB (read-write, created on first run)
// Use /tmp in sandbox environments, data/ in production
const QUIZ_DB_PATH = process.env.QUIZ_DB_PATH
  || path.resolve(process.cwd(), "data/quiz_progress.db");

function getHskDb(): Database.Database {
  if (!fs.existsSync(HSK_DB_PATH)) {
    throw new Error(`HSK DB not found at ${HSK_DB_PATH}. Run the HSK pipeline first.`);
  }
  return new Database(HSK_DB_PATH, { readonly: true });
}

function getQuizDb(): Database.Database {
  const dir = path.dirname(QUIZ_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(QUIZ_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables on first run
  db.exec(`
    -- Per-card SRS state
    CREATE TABLE IF NOT EXISTS card_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simplified TEXT NOT NULL,
      hsk_version TEXT NOT NULL DEFAULT '2.0',
      hsk_level INTEGER NOT NULL DEFAULT 1,
      -- SRS fields (SM-2 algorithm)
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval_days REAL NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review TEXT NOT NULL DEFAULT (date('now')),
      -- Last diagnostic result
      last_dx TEXT CHECK(last_dx IN ('known', 'partial', 'unknown')) DEFAULT NULL,
      -- Timestamps
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(simplified)
    );

    -- Individual review log (every single interaction)
    CREATE TABLE IF NOT EXISTS review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simplified TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('diagnostic', 'practice', 'exam')),
      result TEXT NOT NULL CHECK(result IN ('known', 'partial', 'unknown')),
      response_ms INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Exam snapshots
    CREATE TABLE IF NOT EXISTS exam_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      scope TEXT NOT NULL, -- e.g. 'hsk2.0_l1l2', 'hsk3.0_l1', 'all'
      total_cards INTEGER NOT NULL,
      known INTEGER NOT NULL DEFAULT 0,
      partial INTEGER NOT NULL DEFAULT 0,
      unknown INTEGER NOT NULL DEFAULT 0,
      score_pct REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_progress_next_review ON card_progress(next_review);
    CREATE INDEX IF NOT EXISTS idx_progress_simplified ON card_progress(simplified);
    CREATE INDEX IF NOT EXISTS idx_review_log_created ON review_log(created_at);
  `);

  return db;
}

export interface HskCard {
  simplified: string;
  traditional: string | null;
  pinyin: string;
  pinyin_numeric: string | null;
  pos: string | null;
  meanings_en: string | null;
  frequency_rank: number | null;
  radical: string | null;
  hsk2_level: number | null;
  hsk3_level: number | null;
}

// Block definitions matching the diagnostic file
export type CardBlock =
  | "hsk2_l1"
  | "hsk2_l2"
  | "hsk3_l1_new"
  | "hsk3_l2_new";

export function getCards(block?: CardBlock): HskCard[] {
  const hsk = getHskDb();

  try {
    // Get all HSK 2.0 L1+L2 simplified for filtering
    const hsk2Items = new Set(
      (
        hsk
          .prepare(
            `SELECT DISTINCT simplified FROM vocabulary_levels WHERE hsk_version='2.0' AND level IN (1,2)`
          )
          .all() as { simplified: string }[]
      ).map((r) => r.simplified)
    );

    let query: string;
    const params: Record<string, string | number> = {};

    if (block === "hsk2_l1" || block === "hsk2_l2") {
      const level = block === "hsk2_l1" ? 1 : 2;
      query = `
        SELECT v.simplified, v.traditional, v.pinyin, v.pinyin_numeric, v.pos,
               v.meanings_en, v.frequency_rank, v.radical,
               vl2.level as hsk2_level, MIN(vl3.level) as hsk3_level
        FROM vocabulary_levels vl2
        JOIN vocabulary v ON vl2.simplified = v.simplified
        LEFT JOIN vocabulary_levels vl3 ON vl2.simplified = vl3.simplified AND vl3.hsk_version = '3.0'
        WHERE vl2.hsk_version = '2.0' AND vl2.level = :level
        GROUP BY v.simplified
        ORDER BY CASE WHEN vl2.order_in_level IS NULL THEN 9999 ELSE vl2.order_in_level END
      `;
      params.level = level;
    } else if (block === "hsk3_l1_new" || block === "hsk3_l2_new") {
      const level = block === "hsk3_l1_new" ? 1 : 2;
      query = `
        SELECT v.simplified, v.traditional, v.pinyin, v.pinyin_numeric, v.pos,
               v.meanings_en, v.frequency_rank, v.radical,
               MIN(vl2.level) as hsk2_level, vl3.level as hsk3_level
        FROM vocabulary_levels vl3
        JOIN vocabulary v ON vl3.simplified = v.simplified
        LEFT JOIN vocabulary_levels vl2 ON vl3.simplified = vl2.simplified AND vl2.hsk_version = '2.0'
        WHERE vl3.hsk_version = '3.0' AND vl3.level = :level
        GROUP BY v.simplified
        ORDER BY CASE WHEN vl3.order_in_level IS NULL THEN 9999 ELSE vl3.order_in_level END
      `;
      params.level = level;
    } else {
      // All cards
      query = `
        SELECT v.simplified, v.traditional, v.pinyin, v.pinyin_numeric, v.pos,
               v.meanings_en, v.frequency_rank, v.radical,
               MIN(vl2.level) as hsk2_level, MIN(vl3.level) as hsk3_level
        FROM vocabulary v
        LEFT JOIN vocabulary_levels vl2 ON v.simplified = vl2.simplified AND vl2.hsk_version = '2.0' AND vl2.level IN (1,2)
        LEFT JOIN vocabulary_levels vl3 ON v.simplified = vl3.simplified AND vl3.hsk_version = '3.0' AND vl3.level IN (1,2)
        WHERE vl2.simplified IS NOT NULL OR vl3.simplified IS NOT NULL
        GROUP BY v.simplified
        ORDER BY v.frequency_rank
      `;
    }

    let cards = hsk.prepare(query).all(params) as HskCard[];

    // Filter out HSK 2.0 items from HSK 3.0 "new" blocks
    if (block === "hsk3_l1_new" || block === "hsk3_l2_new") {
      cards = cards.filter((c) => !hsk2Items.has(c.simplified));
    }

    return cards;
  } finally {
    hsk.close();
  }
}

export function getQuizDatabase() {
  return getQuizDb();
}
