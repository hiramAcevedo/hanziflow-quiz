"use client";

import { useEffect, useMemo, useState } from "react";
import { applyTone, type Tone, vToU } from "@/lib/pinyin-tones";

interface Props {
  onSubmit: (composed: string, rawLetters: string, tone: Tone) => void;
  disabled?: boolean;
}

/**
 * Input de letras + selector de tono. El tono se aplica a la ÚLTIMA sílaba
 * (tokens separados por espacios).
 *
 * Atajos de teclado (mientras el input tiene foco):
 *   1 2 3 4 → tonos 1-4
 *   5 o 0   → tono neutro
 *   Enter   → submit
 */
export default function PinyinInput({ onSubmit, disabled = false }: Props) {
  const [raw, setRaw] = useState("");
  const [tone, setTone] = useState<Tone>(0);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Evita capturar mientras se teclea con modificadores.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        setTone(Number(e.key) as Tone);
      } else if (e.key === "5" || e.key === "0") {
        e.preventDefault();
        setTone(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);

  const handleChange = (value: string) => {
    // Bloquea dígitos (los usamos para selector de tono) y caracteres raros.
    const cleaned = vToU(value).replace(/[^a-zA-Zü\s]/g, "");
    setRaw(cleaned.toLowerCase());
  };

  const preview = useMemo(() => {
    if (!raw) return "";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const last = parts[parts.length - 1];
    const withTone = applyTone(last, tone);
    return [...parts.slice(0, -1), withTone].join(" ");
  }, [raw, tone]);

  const submit = () => {
    if (disabled) return;
    if (!raw.trim()) return;
    onSubmit(preview, raw, tone);
  };

  return (
    <div className="space-y-3">
      <div>
        <input
          type="text"
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          autoFocus
          placeholder="pinyin (v → ü · tono con 1-5)"
          className="w-full px-4 py-3 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] focus:border-[var(--accent)] outline-none text-lg tracking-wide disabled:opacity-50"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
        />
        <p className="mt-2 text-center text-2xl tabular-nums min-h-[2.25rem]">
          {preview || <span className="text-neutral-600 text-base">—</span>}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {([1, 2, 3, 4, 0] as Tone[]).map((t) => {
          const key = t === 0 ? "5" : String(t);
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => setTone(t)}
              className={`w-12 h-12 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 relative ${
                tone === t
                  ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-neutral-500"
              }`}
              title={t === 0 ? "tono neutro (5 o 0)" : `tono ${t} (tecla ${t})`}
            >
              <span>{t === 0 ? "·" : t}</span>
              <span className="absolute bottom-0.5 right-1 text-[0.6rem] text-neutral-500">
                {key}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={disabled || !raw.trim()}
        className="w-full py-3 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Validar pinyin (Enter)
      </button>
    </div>
  );
}
