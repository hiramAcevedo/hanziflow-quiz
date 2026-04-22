import path from "path";
import fs from "fs";

// Mismas carpetas que lib/dictado-data.ts; mantenemos la ruta aquí para no
// depender de ese módulo (server-only vs client-accesible).
const TRANSLATIONS_DIR = path.resolve(
  process.cwd(),
  "../hanziflow-audio/translations"
);

// Scopes con JSON de traducciones hoy. Misma lista que SUPPORTED_SCOPES en
// lib/audio-urls.ts, aunque conceptualmente son cosas distintas (audio vs ES)
// — si una cobertura avanza antes que la otra, ajustar aquí.
const COVERED_FILES = ["hsk2.0_l1.json", "hsk2.0_l2.json", "hsk3.0_l1.json"];

let cached: Map<string, string> | null = null;

/**
 * Map `simplified → traducción ES`. Cachea la primera carga en memoria del
 * proceso Node (cold start re-lee los JSON). En dev con Turbopack el caché se
 * invalida al reiniciar.
 *
 * Devuelve `null` como valor por entrada solo en el consumer: aquí la Map
 * solo contiene claves con traducción presente.
 */
export function getTranslationsEs(): Map<string, string> {
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const file of COVERED_FILES) {
    const p = path.join(TRANSLATIONS_DIR, file);
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) {
        // No sobreescribimos: el primer scope gana. Orden en COVERED_FILES es
        // HSK2 L1 → L2 → HSK3 L1, así que los ítems más básicos mandan.
        if (!map.has(k)) map.set(k, v);
      }
    } catch {
      // Archivo corrupto: ignora este scope, sigue con los otros.
    }
  }
  cached = map;
  return map;
}
