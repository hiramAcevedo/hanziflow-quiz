/**
 * Aplica la marca tonal a una sílaba pinyin en letras planas (ya con v→ü).
 * Reglas de posición:
 *  1. tone 0 → sin marca.
 *  2. Si contiene 'a' → marcar la 'a'.
 *  3. Else si contiene 'o' → marcar la 'o'.
 *  4. Else si contiene 'e' → marcar la 'e'.
 *  5. Else → marcar la ÚLTIMA vocal (cubre iu→u, ui→i).
 */

export type Tone = 0 | 1 | 2 | 3 | 4;

const TONES: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

const VOWELS = new Set(["a", "e", "i", "o", "u", "ü"]);

export function vToU(s: string): string {
  return s.replace(/v/g, "ü").replace(/V/g, "Ü");
}

function findToneIndex(s: string): number {
  const a = s.indexOf("a");
  if (a >= 0) return a;
  const o = s.indexOf("o");
  if (o >= 0) return o;
  const e = s.indexOf("e");
  if (e >= 0) return e;
  for (let i = s.length - 1; i >= 0; i--) {
    if (VOWELS.has(s[i])) return i;
  }
  return -1;
}

export function applyTone(syllable: string, tone: Tone): string {
  const s = vToU(syllable);
  if (tone === 0) return s;
  const idx = findToneIndex(s);
  if (idx < 0) return s;
  const base = s[idx];
  const tonic = TONES[base];
  if (!tonic) return s;
  return s.slice(0, idx) + tonic[tone] + s.slice(idx + 1);
}

/**
 * Normaliza pinyin para comparación:
 *  - lowercase
 *  - NFC
 *  - elimina espacios internos (tolera input del usuario sin spaces entre sílabas)
 */
export function normalizePinyin(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

export function pinyinEquals(a: string, b: string): boolean {
  return normalizePinyin(a) === normalizePinyin(b);
}
