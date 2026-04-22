"use client";

import { useEffect, useRef, useState } from "react";

export type HanziDifficulty = "outline" | "hint" | "blank";

interface Props {
  /** El carácter a practicar. Multi-hanzi se quizzean en orden. */
  character: string;
  onComplete: (allCorrect: boolean) => void;
  size?: number;
  difficulty?: HanziDifficulty;
}

/**
 * Wrapper de hanzi-writer en modo quiz.
 * Dificultad:
 *  - "outline": muestra el contorno difuminado (más fácil).
 *  - "hint":    sin contorno, pero tras 1 error se muestra el trazo esperado.
 *  - "blank":   sin contorno ni hints (más difícil).
 */
export default function HanziCanvas({
  character,
  onComplete,
  size = 340,
  difficulty = "outline",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const chars = [...character];
  const perCharMistakes = useRef<number[]>([]);

  // Reset cuando cambia el carácter o la dificultad.
  useEffect(() => {
    setIdx(0);
    setMistakes(0);
    perCharMistakes.current = [];
  }, [character, difficulty]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (idx >= chars.length) return;

    let cancelled = false;

    (async () => {
      const mod = await import("hanzi-writer");
      if (cancelled) return;
      const HanziWriter = mod.default;

      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      const writer = HanziWriter.create(container, chars[idx], {
        width: size,
        height: size,
        padding: 5,
        showCharacter: false,
        showOutline: difficulty === "outline",
        strokeColor: "#3b82f6",
        outlineColor: "#2a2a2a",
        highlightColor: "#22c55e",
        drawingWidth: 30,
      });

      let localMistakes = 0;

      const quizOpts: {
        onMistake: () => void;
        onComplete: () => void;
        showHintAfterMisses?: number;
      } = {
        onMistake: () => {
          localMistakes += 1;
          setMistakes((m) => m + 1);
        },
        onComplete: () => {
          perCharMistakes.current = [...perCharMistakes.current, localMistakes];
          if (idx + 1 >= chars.length) {
            const allPerfect = perCharMistakes.current.every((n) => n === 0);
            setTimeout(() => onComplete(allPerfect), 0);
          } else {
            setTimeout(() => setIdx((i) => i + 1), 200);
          }
        },
      };
      if (difficulty === "hint") quizOpts.showHintAfterMisses = 1;
      // blank: no hint; hanzi-writer's default shows hint after 3 misses, so we
      // push it far out of reach.
      if (difficulty === "blank") quizOpts.showHintAfterMisses = 999;

      writer.quiz(quizOpts);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, character, difficulty]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <span className="px-2 py-1 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
          {idx + 1}/{chars.length}
        </span>
        <span className="text-neutral-500">errores: {mistakes}</span>
      </div>
      <div
        ref={containerRef}
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg"
        style={{ width: size, height: size, touchAction: "none" }}
      />
    </div>
  );
}
