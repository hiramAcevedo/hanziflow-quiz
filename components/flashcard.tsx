"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { parseMeanings, parsePos } from "@/lib/utils";
import AudioPlayer from "./dictado/audio-player";
import {
  cnAudioUrl,
  CN_VOICES,
  DEFAULT_VOICE,
  isCnVoice,
  type CnVoice,
} from "@/lib/audio-urls";
import { scopeForCard } from "@/lib/scope-for-card";
import { entryId } from "@/lib/entry-id";

const VOICE_STORAGE_KEY = "hanziflow.audio.voice";

export interface CardData {
  simplified: string;
  traditional?: string | null;
  pinyin: string;
  pinyin_numeric?: string | null;
  pos?: string | null;
  meanings_en?: string | null;
  translation_es?: string | null;
  frequency_rank?: number | null;
  radical?: string | null;
  hsk2_level?: number | null;
  hsk3_level?: number | null;
}

type Result = "known" | "partial" | "unknown";

interface FlashcardProps {
  card: CardData;
  onResult: (result: Result, responseMs: number) => void;
  index: number;
  total: number;
  mode: "diagnostic" | "practice" | "exam";
}

export default function Flashcard({
  card,
  onResult,
  index,
  total,
  mode,
}: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const [startTime] = useState(Date.now());
  const [voice, setVoice] = useState<CnVoice>(DEFAULT_VOICE);
  const [playToken, setPlayToken] = useState(0);
  // Contenido que se pinta ahora mismo. Se queda rezagado respecto a `card`
  // durante la animación de flip-back para que el usuario nunca vea la
  // siguiente tarjeta asomándose entre rotaciones.
  const [displayCard, setDisplayCard] = useState<CardData>(card);

  // Al cambiar `card`: iniciamos flip-back con el contenido anterior y
  // swapeamos en el punto edge-on (~mitad del flip, t=200ms sobre los 400ms
  // del CSS) donde ambas caras están invisibles por backface-visibility.
  // El fade-in del nuevo contenido corre entonces DURANTE la segunda mitad
  // de la rotación (90°→0°), no después — se siente continuo en vez de
  // aditivo.
  useEffect(() => {
    if (displayCard.simplified === card.simplified) return;
    setFlipped(false);
    const t = setTimeout(() => setDisplayCard(card), 200);
    return () => clearTimeout(t);
  }, [card, displayCard.simplified]);

  // Carga voz persistida en localStorage (solo cliente).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      if (saved && isCnVoice(saved)) setVoice(saved);
    } catch {
      // ignore
    }
  }, []);

  const updateVoice = useCallback((v: CnVoice) => {
    setVoice(v);
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, v);
    } catch {
      // ignore
    }
  }, []);

  const audioScope = useMemo(() => scopeForCard(displayCard), [displayCard]);
  const audioSrc = useMemo(() => {
    if (!audioScope) return null;
    return cnAudioUrl(audioScope, voice, entryId(displayCard.simplified));
  }, [audioScope, voice, displayCard.simplified]);

  // Audio solo al voltear: cierra el círculo pedagógico (ver → recordar →
  // confirmar con sonido). Evita delatar la respuesta antes del intento.
  useEffect(() => {
    if (flipped && audioSrc) setPlayToken((t) => t + 1);
  }, [flipped, audioSrc]);

  const handleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const handleResult = useCallback(
    (result: Result) => {
      const ms = Date.now() - startTime;
      onResult(result, ms);
    },
    [onResult, startTime]
  );

  // Keyboard shortcuts. Usamos un ref para mantener valores actuales sin
  // re-bindear el listener en cada render — evita que un keypress llegue
  // durante el re-bind y se pierda (reportado como "hay que presionar j dos
  // veces" al probar desde iPad por LAN).
  const kbRef = useRef({ flipped, handleResult, hasAudio: audioSrc !== null });
  kbRef.current = { flipped, handleResult, hasAudio: audioSrc !== null };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { flipped, handleResult, hasAudio } = kbRef.current;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        return;
      }
      if ((e.key === "r" || e.key === "R") && flipped && hasAudio) {
        e.preventDefault();
        setPlayToken((t) => t + 1);
        return;
      }
      if (flipped) {
        if (e.key === "1" || e.key === "j") handleResult("known");
        if (e.key === "2" || e.key === "k") handleResult("partial");
        if (e.key === "3" || e.key === "l") handleResult("unknown");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const meanings = parseMeanings(displayCard.meanings_en ?? null);
  const pos = parsePos(displayCard.pos ?? null);
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  const badges: string[] = [];
  if (displayCard.hsk2_level) badges.push(`HSK 2.0 L${displayCard.hsk2_level}`);
  if (displayCard.hsk3_level) badges.push(`HSK 3.0 L${displayCard.hsk3_level}`);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-[var(--card-border)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, var(--accent), var(--known))`,
            }}
          />
        </div>
        <span className="text-sm text-neutral-400 tabular-nums min-w-[4rem] text-right">
          {index + 1} / {total}
        </span>
      </div>

      {/* Audio + selector de voz. Autoplay al cambiar de tarjeta; `r` repite.
          Si la tarjeta no tiene cache de audio (hoy: HSK 3.0 L2 nuevos), se
          muestra un placeholder. Ver AUDIO_WRITE_PLAN.md §11. */}
      <div
        className="w-full flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Voz</span>
          <div className="flex gap-1">
            {CN_VOICES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => updateVoice(v)}
                className={`px-2 py-1 rounded border ${
                  voice === v
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-[var(--card-border)] hover:border-neutral-500"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {audioSrc ? (
          flipped ? (
            <AudioPlayer
              key={audioSrc}
              src={audioSrc}
              label="▶ Repetir (R)"
              playToken={playToken}
            />
          ) : (
            <span className="text-neutral-500 italic">audio tras voltear</span>
          )
        ) : (
          <span className="text-neutral-500 italic">sin audio próximamente</span>
        )}
      </div>

      {/* Card */}
      <div
        className="card-flip w-full aspect-[3/2] cursor-pointer select-none"
        onClick={handleFlip}
      >
        <div className={`card-flip-inner w-full h-full relative ${flipped ? "flipped" : ""}`}>
          {/* Front — Hanzi only */}
          <div className="card-front absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8">
            <div
              key={displayCard.simplified}
              className="card-content-fade flex flex-col items-center justify-center"
            >
              <span className="text-7xl sm:text-8xl font-normal tracking-wide">
                {displayCard.simplified}
              </span>
              {badges.length > 0 && (
                <div className="flex gap-2 mt-6">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-neutral-500 text-sm mt-4">
                Toca o presiona espacio para voltear
              </p>
            </div>
          </div>

          {/* Back — Full info */}
          <div className="card-back absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 gap-3">
            <div
              key={displayCard.simplified}
              className="card-content-fade flex flex-col items-center justify-center gap-3"
            >
              <span className="text-5xl sm:text-6xl">{displayCard.simplified}</span>
              <span className="text-2xl text-[var(--accent)]">{displayCard.pinyin}</span>
              {pos.length > 0 && (
                <span className="text-xs text-neutral-500">
                  {pos.join(" / ")}
                </span>
              )}
              {/* Traducción: ES preferido, EN como fallback cuando la cobertura
                  aún no alcanza la tarjeta (ver AUDIO_WRITE_PLAN.md §11). */}
              {displayCard.translation_es ? (
                <div className="text-center text-neutral-200 text-lg leading-relaxed max-h-24 overflow-y-auto">
                  {displayCard.translation_es}
                </div>
              ) : (
                <div className="text-center text-neutral-400 text-base leading-relaxed max-h-24 overflow-y-auto italic">
                  {meanings.slice(0, 3).join(" · ") || "—"}
                </div>
              )}
              {displayCard.radical && (
                <span className="text-xs text-neutral-500">
                  Radical: {displayCard.radical} · Freq: {displayCard.frequency_rank ?? "—"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Response buttons (only visible when flipped) */}
      {flipped && (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => handleResult("known")}
            className="flex-1 py-4 rounded-xl font-medium text-lg transition-all
                       bg-green-500/10 border border-green-500/30 text-green-400
                       hover:bg-green-500/20 active:scale-95"
          >
            <span className="text-2xl block">☑</span>
            <span className="text-sm">Conozco</span>
            <span className="text-xs text-neutral-500 block mt-1">1 / J</span>
          </button>
          <button
            onClick={() => handleResult("partial")}
            className="flex-1 py-4 rounded-xl font-medium text-lg transition-all
                       bg-amber-500/10 border border-amber-500/30 text-amber-400
                       hover:bg-amber-500/20 active:scale-95"
          >
            <span className="text-2xl block">◐</span>
            <span className="text-sm">Parcial</span>
            <span className="text-xs text-neutral-500 block mt-1">2 / K</span>
          </button>
          <button
            onClick={() => handleResult("unknown")}
            className="flex-1 py-4 rounded-xl font-medium text-lg transition-all
                       bg-red-500/10 border border-red-500/30 text-red-400
                       hover:bg-red-500/20 active:scale-95"
          >
            <span className="text-2xl block">☐</span>
            <span className="text-sm">No sé</span>
            <span className="text-xs text-neutral-500 block mt-1">3 / L</span>
          </button>
        </div>
      )}

      {/* Mode indicator */}
      <span className="text-xs text-neutral-600 uppercase tracking-widest">
        {mode === "diagnostic" ? "diagnóstico" : mode === "practice" ? "práctica srs" : "examen"}
      </span>
    </div>
  );
}
