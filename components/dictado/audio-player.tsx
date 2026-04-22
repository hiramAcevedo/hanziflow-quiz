"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  /** Si true, intenta reproducir automáticamente al montarse. Safari puede bloquearlo. */
  autoPlay?: boolean;
  label?: string;
  className?: string;
  /**
   * Cada vez que este número cambia (y es > 0) el player reproduce. Útil para
   * atajos externos (ej. tecla "r" en item-loop).
   */
  playToken?: number;
}

export default function AudioPlayer({ src, autoPlay = false, label = "▶ Reproducir", className = "", playToken = 0 }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Cambió el src: reset
    el.currentTime = 0;
    setBlocked(false);
    if (autoPlay) {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => setBlocked(true));
      }
    }
  }, [src, autoPlay]);

  // Replay externo vía incremento de playToken.
  useEffect(() => {
    if (playToken <= 0) return;
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [playToken]);

  const play = () => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <audio ref={ref} src={src} preload="auto" />
      <button
        type="button"
        onClick={play}
        className="px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)] transition-colors text-sm"
      >
        {blocked ? "▶ Empezar" : label}
      </button>
    </div>
  );
}
