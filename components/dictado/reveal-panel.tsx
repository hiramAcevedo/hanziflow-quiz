"use client";

import { useEffect, useMemo, useState } from "react";
import { pinyin } from "pinyin-pro";
import AudioPlayer from "./audio-player";

interface Props {
  simplified: string;
  pinyin: string;
  translationEs: string | null;
  exampleZh: string | null;
  exampleEs: string | null;
  sentAudioCn: string;
  sentAudioEs: string;
  /** Preferencia global (se controla desde el panel de config del item-loop). */
  showSentencePinyin: boolean;
  onSelfGrade: (grade: "again" | "hard" | "good" | "easy") => void;
}

interface Pair {
  char: string;
  py: string;
  /** Forma de citación (carácter aislado). Solo se setea si difiere del
   *  pinyin en contexto — señal visible de que hubo sandhi. */
  citation: string | null;
}

function stripTone(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function RevealPanel({
  simplified,
  pinyin: wordPinyin,
  translationEs,
  exampleZh,
  exampleEs,
  sentAudioCn,
  sentAudioEs,
  showSentencePinyin,
  onSelfGrade,
}: Props) {
  // Peek efímero: por-tarjeta, se resetea al cambiar de oración. No afecta
  // la preferencia global (viene por prop desde item-loop).
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    setPeek(false);
  }, [exampleZh]);

  // ⌥O — peek ad-hoc del pinyin de oración (sólo tiene efecto visible cuando
  // el switch global está apagado; si ya está visible, el toggle es inocuo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.code === "KeyO") {
        e.preventDefault();
        setPeek((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Par hanzi ↔ pinyin alineado columna a columna. Pasamos la oración
  // entera a pinyin-pro para que aplique sandhi (不, 一, 3º+3º, etc.), y
  // por separado pedimos la forma de citación de cada carácter aislado
  // para detectar dónde hubo cambio — se renderiza en otro color con
  // tooltip del pinyin original.
  const pairs = useMemo<Pair[]>(() => {
    if (!exampleZh) return [];
    const chars = [...exampleZh];
    let tokens: string[] = [];
    try {
      const arr = pinyin(exampleZh, { type: "array", nonZh: "consecutive" });
      if (Array.isArray(arr)) tokens = arr.map(String);
    } catch {
      tokens = [];
    }
    const isHan = (c: string) => /\p{Script=Han}/u.test(c);
    const out: Pair[] = [];
    let t = 0;
    for (const c of chars) {
      if (isHan(c)) {
        while (t < tokens.length && !/[a-zA-Zü]/i.test(tokens[t])) t++;
        const py = tokens[t] ?? "";
        t++;
        let citation: string | null = null;
        if (py) {
          try {
            const cite = pinyin(c, { type: "string" }) as string;
            // Ignora diferencias puramente ortográficas (mayúsculas, v/ü).
            if (cite && stripTone(cite) === stripTone(py) && cite !== py) {
              citation = cite;
            } else if (cite && cite !== py && stripTone(cite) !== stripTone(py)) {
              // Diferencia de sílaba base (raro, p. ej. 乐 yuè↔lè). Lo
              // marcamos igual — es un cambio real que vale la pena mostrar.
              citation = cite;
            }
          } catch {
            // Si la forma aislada falla, no marcamos sandhi.
          }
        }
        out.push({ char: c, py, citation });
      } else {
        out.push({ char: c, py: "", citation: null });
      }
    }
    return out;
  }, [exampleZh]);

  const hasHanzi = pairs.some((p) => p.py);
  const pinyinVisible = showSentencePinyin || peek;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="text-6xl font-medium">{simplified}</div>
        <div className="text-xl text-[var(--accent)]">{wordPinyin}</div>
        {translationEs && (
          <div className="text-base text-neutral-300">{translationEs}</div>
        )}
      </div>

      {(exampleZh || exampleEs) && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3">
          {exampleZh && (
            <div className="flex items-start justify-between gap-3">
              <div
                className={`flex-1 min-w-0 ${hasHanzi ? "cursor-pointer select-none" : ""}`}
                onClick={hasHanzi ? () => setPeek((p) => !p) : undefined}
                title={
                  !hasHanzi
                    ? undefined
                    : showSentencePinyin
                      ? "Pinyin siempre visible (config · ⌥P)"
                      : peek
                        ? "Toca para ocultar (⌥O)"
                        : "Toca para ver pinyin (⌥O)"
                }
              >
                {/* Pinyin arriba, más pequeño y neutro; hanzi abajo, anclaje
                    visual. La fila de pinyin siempre se renderiza (aunque
                    esté difuminada) para que no haya reflow al alternar. */}
                <div className="inline-flex flex-wrap items-end gap-x-0.5 gap-y-1">
                  {pairs.map((p, i) => {
                    const sandhi = p.citation !== null;
                    const pyClass = pinyinVisible
                      ? sandhi
                        ? "text-[var(--accent)]"
                        : "text-neutral-500"
                      : p.py
                        ? "text-transparent bg-neutral-700/40 rounded blur-[3px] select-none"
                        : "text-transparent";
                    return (
                      <span
                        key={i}
                        className="inline-flex flex-col items-center leading-tight min-w-[1.25em]"
                        title={
                          pinyinVisible && sandhi && p.citation
                            ? `sandhi: ${p.citation} → ${p.py}`
                            : undefined
                        }
                      >
                        <span className={`text-sm tabular-nums transition ${pyClass}`}>
                          {p.py || "\u00A0"}
                        </span>
                        <span className="text-2xl">{p.char}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <AudioPlayer src={sentAudioCn} label="▶ CN" />
            </div>
          )}
          {exampleEs && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-base text-neutral-400">{exampleEs}</p>
              <AudioPlayer src={sentAudioEs} label="▶ ES" />
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-xs text-neutral-500 mb-2 text-center">¿Qué tal te fue?</p>
        <div className="grid grid-cols-4 gap-2">
          <SelfGradeBtn color="red" label="Otra vez" keyHint="1" onClick={() => onSelfGrade("again")} />
          <SelfGradeBtn color="amber" label="Difícil" keyHint="2" onClick={() => onSelfGrade("hard")} />
          <SelfGradeBtn color="green" label="Bien" keyHint="3" onClick={() => onSelfGrade("good")} />
          <SelfGradeBtn color="blue" label="Fácil" keyHint="4" onClick={() => onSelfGrade("easy")} />
        </div>
      </div>
    </div>
  );
}

function SelfGradeBtn({
  color,
  label,
  keyHint,
  onClick,
}: {
  color: "red" | "amber" | "green" | "blue";
  label: string;
  keyHint?: string;
  onClick: () => void;
}) {
  const colorClass: Record<typeof color, string> = {
    red: "hover:border-red-500 hover:text-red-400",
    amber: "hover:border-amber-500 hover:text-amber-400",
    green: "hover:border-green-500 hover:text-green-400",
    blue: "hover:border-[var(--accent)] hover:text-[var(--accent)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={keyHint ? `Tecla: ${keyHint}` : undefined}
      className={`py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm transition-colors ${colorClass[color]}`}
    >
      {label}
      {keyHint && (
        <span className="ml-1 text-[0.6rem] text-neutral-500">({keyHint})</span>
      )}
    </button>
  );
}
