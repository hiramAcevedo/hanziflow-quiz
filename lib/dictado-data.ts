import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const HSK_DB_PATH = path.resolve(
  process.cwd(),
  "../HSK-word-list/hanzi-flow-hsk/output/hsk_vocabulary.db"
);

const AUDIO_ROOT = path.resolve(process.cwd(), "../hanziflow-audio");
const TRANSLATIONS_DIR = path.join(AUDIO_ROOT, "translations");
const SENTENCES_DIR = path.join(AUDIO_ROOT, "sentences");

const ALT_FORM_SEP = "｜"; // U+FF5C, same convention as hanziflow-audio/sources.py

export interface DictadoScopeEntry {
  simplified: string;
  pinyin: string;
  meanings_en: string[];
  translation_es: string | null;
  example_zh: string | null;
  example_es: string | null;
}

function canonical(text: string): string {
  if (!text.includes(ALT_FORM_SEP)) return text;
  return text.split(ALT_FORM_SEP, 2)[0].trim();
}

function parseScope(scope: string): { hsk_version: string; level: number } | null {
  const m = /^hsk(\d\.\d)_l(\d+)$/.exec(scope);
  if (!m) return null;
  return { hsk_version: m[1], level: Number(m[2]) };
}

function loadHskEntries(hsk_version: string, level: number) {
  if (!fs.existsSync(HSK_DB_PATH)) {
    throw new Error(`HSK DB not found at ${HSK_DB_PATH}`);
  }
  const db = new Database(HSK_DB_PATH, { readonly: true });
  try {
    const rows = db
      .prepare(
        `
        SELECT DISTINCT v.simplified, v.pinyin, v.meanings_en
        FROM vocabulary v
        JOIN vocabulary_levels vl ON vl.simplified = v.simplified
        WHERE vl.hsk_version = ? AND vl.level = ?
        ORDER BY COALESCE(v.frequency_rank, 999999), v.simplified
        `
      )
      .all(hsk_version, level) as Array<{
      simplified: string;
      pinyin: string | null;
      meanings_en: string | null;
    }>;

    const seen = new Set<string>();
    const out: Array<{ simplified: string; pinyin: string; meanings_en: string[] }> = [];
    for (const r of rows) {
      const simp = canonical(r.simplified);
      if (seen.has(simp)) continue;
      seen.add(simp);
      let meanings: string[] = [];
      if (r.meanings_en) {
        try {
          const parsed = JSON.parse(r.meanings_en);
          meanings = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          meanings = [r.meanings_en];
        }
      }
      out.push({
        simplified: simp,
        pinyin: canonical(r.pinyin ?? ""),
        meanings_en: meanings,
      });
    }
    return out;
  } finally {
    db.close();
  }
}

function loadTranslationsEs(scope: string): Record<string, string> {
  const p = path.join(TRANSLATIONS_DIR, `${scope}.json`);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function loadSentences(scope: string) {
  const p = path.join(SENTENCES_DIR, `${scope}.md`);
  const zh: Record<string, string> = {};
  const es: Record<string, string> = {};
  if (!fs.existsSync(p)) return { zh, es };

  const text = fs.readFileSync(p, "utf8");
  let current: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    const header = /^##\s+(\S+)/.exec(line);
    if (header) {
      current = header[1];
      continue;
    }
    if (!current) continue;
    const stripped = line.trim();
    if (!stripped) continue;
    const upper = stripped.toUpperCase();
    if (upper.startsWith("ES:") || upper.startsWith("ESPAÑOL:")) {
      const txt = stripped.split(":").slice(1).join(":").trim();
      if (txt && !(current in es)) es[current] = txt;
      continue;
    }
    if (upper.startsWith("ZH:") || upper.startsWith("CN:")) {
      const txt = stripped.split(":").slice(1).join(":").trim();
      if (txt && !(current in zh)) zh[current] = txt;
      continue;
    }
    if (!(current in zh)) zh[current] = stripped;
  }
  return { zh, es };
}

export function loadDictadoScope(scope: string): DictadoScopeEntry[] {
  const parsed = parseScope(scope);
  if (!parsed) throw new Error(`scope mal formado: ${scope}`);

  const hsk = loadHskEntries(parsed.hsk_version, parsed.level);
  const translations = loadTranslationsEs(scope);
  const { zh: sentZh, es: sentEs } = loadSentences(scope);

  return hsk.map((e) => ({
    simplified: e.simplified,
    pinyin: e.pinyin,
    meanings_en: e.meanings_en,
    translation_es: translations[e.simplified] ?? null,
    example_zh: sentZh[e.simplified] ?? null,
    example_es: sentEs[e.simplified] ?? null,
  }));
}
