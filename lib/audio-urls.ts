export type CnVoice = "corta" | "larga" | "neutral";
export const CN_VOICES: CnVoice[] = ["corta", "larga", "neutral"];
export const DEFAULT_VOICE: CnVoice = "larga";

export const SUPPORTED_SCOPES = ["hsk2.0_l1", "hsk2.0_l2", "hsk3.0_l1"] as const;
export type Scope = (typeof SUPPORTED_SCOPES)[number];

export function isSupportedScope(s: string): s is Scope {
  return (SUPPORTED_SCOPES as readonly string[]).includes(s);
}

export function isCnVoice(s: string): s is CnVoice {
  return (CN_VOICES as readonly string[]).includes(s);
}

function base(scope: string, segment: string) {
  return `/api/dictado/audio/${encodeURIComponent(scope)}/${segment}`;
}

export function cnAudioUrl(scope: string, voice: CnVoice, eid: string) {
  return base(scope, `${encodeURIComponent(voice)}/${eid}_cn.mp3`);
}

export function sentAudioUrl(scope: string, voice: CnVoice, eid: string) {
  return base(scope, `${encodeURIComponent(voice)}/${eid}_sent.mp3`);
}

export function esAudioUrl(scope: string, eid: string) {
  return base(scope, `_es/${eid}_es.mp3`);
}

export function sentEsAudioUrl(scope: string, eid: string) {
  return base(scope, `_es/${eid}_sent_es.mp3`);
}
