import crypto from "crypto";

/**
 * Same hash as hanziflow-audio/edge_tts: md5(simplified) truncated to 10 hex
 * chars. Used to build audio cache filenames `<eid>_cn.mp3`, `<eid>_sent.mp3`,
 * `<eid>_es.mp3`, `<eid>_sent_es.mp3`.
 */
export function entryId(simplified: string): string {
  return crypto.createHash("md5").update(simplified, "utf8").digest("hex").slice(0, 10);
}
