"use client";

import { useState, useCallback, useEffect } from "react";
import { parseMeanings, parsePos } from "@/lib/utils";

export interface CardData {
  simplified: string;
  traditional?: string | null;
  pinyin: string;
  pinyin_numeric?: string | null;
  pos?: string | null;
  meanings_en?: string | null;
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

  // Reset flip on card change
  useEffect(() => {
    setFlipped(false);
  }, [card.simplified]);

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

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) {
          setFlipped(true);
        }
      }
      if (flipped) {
        if (e.key === "1" || e.key === "j") handleResult("known");
        if (e.key === "2" || e.key === "k") handleResult("partial");
        if (e.key === "3" || e.key === "l") handleResult("unknown");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, handleResult]);

  const meanings = parseMeanings(card.meanings_en ?? null);
  const pos = parsePos(card.pos ?? null);
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  const badges: string[] = [];
  if (card.hsk2_level) badges.push(`HSK 2.0 L${card.hsk2_level}`);
  if (card.hsk3_level) badges.push(`HSK 3.0 L${card.hsk3_level}`);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
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

      {/* Card */}
      <div
        className="card-flip w-full aspect-[3/2] cursor-pointer select-none"
        onClick={handleFlip}
      >
        <div className={`card-flip-inner w-full h-full relative ${flipped ? "flipped" : ""}`}>
          {/* Front — Hanzi only */}
          <div className="card-front absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8">
            <span className="text-7xl sm:text-8xl font-normal tracking-wide">
              {card.simplified}
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

          {/* Back — Full info */}
          <div className="card-back absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 gap-3">
            <span className="text-5xl sm:text-6xl">{card.simplified}</span>
            <span className="text-2xl text-[var(--accent)]">{card.pinyin}</span>
            {pos.length > 0 && (
              <span className="text-xs text-neutral-500">
                {pos.join(" / ")}
              </span>
            )}
            <div className="text-center text-neutral-300 text-lg leading-relaxed max-h-24 overflow-y-auto">
              {meanings.slice(0, 3).join(" · ")}
            </div>
            {card.radical && (
              <span className="text-xs text-neutral-500">
                Radical: {card.radical} · Freq: {card.frequency_rank ?? "—"}
              </span>
            )}
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
