import type { Scope } from "./audio-urls";

/**
 * Infiere el scope de audio desde los metadatos HSK de la tarjeta.
 *
 * Devuelve `null` cuando la tarjeta pertenece a un scope sin cache de audio
 * (hoy: HSK 3.0 L2 nuevos, vocab externo). El caller debe degradar a un
 * placeholder "sin audio". Ver AUDIO_WRITE_PLAN.md §11 (deuda técnica).
 *
 * Prioridad: HSK 2.0 gana sobre HSK 3.0 porque los items compartidos ya tienen
 * audio en la carpeta HSK 2.0 y evita regenerar.
 */
export function scopeForCard(card: {
  hsk2_level?: number | null;
  hsk3_level?: number | null;
}): Scope | null {
  if (card.hsk2_level === 1) return "hsk2.0_l1";
  if (card.hsk2_level === 2) return "hsk2.0_l2";
  if (card.hsk3_level === 1) return "hsk3.0_l1";
  return null;
}
