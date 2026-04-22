"use client";

import { useState, useEffect, useCallback } from "react";
import Flashcard, { type CardData } from "@/components/flashcard";
import Link from "next/link";

type Result = "known" | "partial" | "unknown";

interface DueCard {
  simplified: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  last_dx: string | null;
}

const BLOCKS = [
  { id: "hsk2_l1", label: "HSK 2.0 — Nivel 1" },
  { id: "hsk2_l2", label: "HSK 2.0 — Nivel 2" },
  { id: "hsk3_l1_new", label: "HSK 3.0 L1 (nuevos)" },
  { id: "hsk3_l2_new", label: "HSK 3.0 L2 (nuevos)" },
];

const SELECTION_KEY = "hanziflow.practice.blocks";

interface SessionEntry {
  simplified: string;
  pinyin: string;
  translation_es: string | null;
  meanings_en: string | null;
  result: Result;
  response_ms: number;
}

export default function PracticePage() {
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [cardDetails, setCardDetails] = useState<Map<string, CardData>>(new Map());
  const [current, setCurrent] = useState(0);
  const [sessionStats, setSessionStats] = useState({ known: 0, partial: 0, unknown: 0 });
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [sessionStartMs, setSessionStartMs] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Recuerda la selección entre sesiones — facilita entrenar el mismo scope.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SELECTION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((x) =>
            BLOCKS.some((b) => b.id === x)
          );
          if (valid.length > 0) setSelectedBlocks(valid);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Advance past cards without details (effect-driven, not during render).
  useEffect(() => {
    if (loading || done || dueCards.length === 0) return;
    const due = dueCards[current];
    if (!due) return;
    if (cardDetails.size > 0 && !cardDetails.has(due.simplified)) {
      if (current + 1 >= dueCards.length) {
        setDone(true);
      } else {
        setCurrent((c) => c + 1);
      }
    }
  }, [current, dueCards, cardDetails, loading, done]);

  // Carga tras iniciar. Une los scopes seleccionados → construye un Set de
  // simplified permitidos → filtra la cola due contra esa whitelist.
  const startSession = useCallback(async () => {
    if (selectedBlocks.length === 0) return;
    setLoading(true);
    setStarted(true);
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedBlocks));
    } catch {
      // ignore
    }
    try {
      const allowed = new Set<string>();
      const map = new Map<string, CardData>();
      for (const blockId of selectedBlocks) {
        const res = await fetch(`/api/cards?block=${blockId}`);
        if (!res.ok) throw new Error(`cards fetch failed (${blockId})`);
        const data = await res.json();
        for (const c of (data.cards ?? []) as CardData[]) {
          allowed.add(c.simplified);
          if (!map.has(c.simplified)) map.set(c.simplified, c);
        }
      }
      setCardDetails(map);

      const dueRes = await fetch("/api/progress?limit=500");
      if (!dueRes.ok) throw new Error("due fetch failed");
      const dueData = await dueRes.json();
      const due: DueCard[] = (dueData.due ?? []).filter((d: DueCard) =>
        allowed.has(d.simplified)
      );

      const shuffled = [...due].sort(() => Math.random() - 0.5);
      setDueCards(shuffled);
      setCurrent(0);
      setSessionStats({ known: 0, partial: 0, unknown: 0 });
      setSessionLog([]);
      setSessionStartMs(Date.now());
      setDone(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedBlocks]);

  const handleResult = useCallback(
    (result: Result, responseMs: number) => {
      const due = dueCards[current];
      if (!due) return;
      const details = cardDetails.get(due.simplified);

      // UI optimista (ver diagnostic/page.tsx para el razonamiento).
      setSessionStats((prev) => ({ ...prev, [result]: prev[result] + 1 }));
      setSessionLog((log) => [
        ...log,
        {
          simplified: due.simplified,
          pinyin: details?.pinyin ?? "",
          translation_es: details?.translation_es ?? null,
          meanings_en: details?.meanings_en ?? null,
          result,
          response_ms: responseMs,
        },
      ]);
      if (current + 1 >= dueCards.length) {
        setDone(true);
      } else {
        setCurrent((c) => c + 1);
      }

      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simplified: due.simplified,
          result,
          mode: "practice",
          response_ms: responseMs,
        }),
      }).catch((err) => console.error("progress POST failed", err));
    },
    [dueCards, current, cardDetails]
  );

  // Selector de scopes — se muestra antes de iniciar la sesión.
  if (!started) {
    const allSelected = selectedBlocks.length === BLOCKS.length;
    const toggleAll = () => {
      setSelectedBlocks(allSelected ? [] : BLOCKS.map((b) => b.id));
    };
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300 mb-6 inline-block"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold mb-2">Práctica SRS</h1>
        <p className="text-neutral-400 mb-6">
          Selecciona los scopes que quieres practicar. La cola mezcla las
          tarjetas pendientes de todos los scopes elegidos.
        </p>

        <div className="space-y-3 mb-6">
          {BLOCKS.map((b) => (
            <label
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 cursor-pointer hover:border-[var(--accent)] transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedBlocks.includes(b.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedBlocks((prev) => [...prev, b.id]);
                  } else {
                    setSelectedBlocks((prev) => prev.filter((x) => x !== b.id));
                  }
                }}
                className="accent-[var(--accent)] w-5 h-5"
              />
              <span className="font-medium">{b.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
        </div>

        <button
          onClick={startSession}
          disabled={selectedBlocks.length === 0}
          className="w-full py-4 rounded-xl bg-[var(--accent)] text-white font-semibold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Iniciar sesión SRS
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 animate-pulse">Cargando cola SRS...</p>
      </main>
    );
  }

  // No cards due
  if (dueCards.length === 0 && !done) {
    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col items-center justify-center gap-6">
        <span className="text-6xl">🎉</span>
        <h1 className="text-2xl font-bold">Sin tarjetas pendientes</h1>
        <p className="text-neutral-400 text-center">
          No hay tarjetas de los scopes seleccionados programadas para hoy.
          Prueba con otro scope, haz un diagnóstico para alimentar la cola,
          o vuelve mañana.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setStarted(false);
            }}
            className="px-6 py-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]"
          >
            Cambiar scopes
          </button>
          <Link
            href="/diagnostic"
            className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium"
          >
            Ir a diagnóstico
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-[var(--card-border)]"
          >
            Inicio
          </Link>
        </div>
      </main>
    );
  }

  // Session done
  if (done) {
    const total = sessionStats.known + sessionStats.partial + sessionStats.unknown;
    const durationMs = sessionStartMs > 0 ? Date.now() - sessionStartMs : 0;
    const mins = Math.floor(durationMs / 60000);
    const secs = Math.floor((durationMs % 60000) / 1000);
    const avgMs =
      sessionLog.length > 0
        ? Math.round(
            sessionLog.reduce((acc, e) => acc + e.response_ms, 0) /
              sessionLog.length
          )
        : 0;
    const scopeLabels = selectedBlocks
      .map((id) => BLOCKS.find((b) => b.id === id)?.label ?? id)
      .join(" · ");

    return (
      <main className="min-h-screen p-6 max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex flex-col items-center gap-3 pt-4">
          <span className="text-5xl">✅</span>
          <h1 className="text-2xl font-bold">Sesión SRS completada</h1>
          <p className="text-xs text-neutral-500 text-center">{scopeLabels}</p>
        </header>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Total" value={String(total)} tone="neutral" />
          <Metric
            label="Conozco"
            value={String(sessionStats.known)}
            tone="green"
          />
          <Metric
            label="Parcial"
            value={String(sessionStats.partial)}
            tone="amber"
          />
          <Metric
            label="No sé"
            value={String(sessionStats.unknown)}
            tone="red"
          />
          <Metric
            label="Duración"
            value={`${mins}m ${secs}s`}
            tone="neutral"
          />
          <Metric
            label="Promedio/tarjeta"
            value={`${(avgMs / 1000).toFixed(1)}s`}
            tone="neutral"
          />
          <Metric
            label="Acierto"
            value={`${total > 0 ? Math.round(((sessionStats.known + sessionStats.partial * 0.5) / total) * 100) : 0}%`}
            tone="neutral"
          />
          <Metric
            label="Scopes"
            value={String(selectedBlocks.length)}
            tone="neutral"
          />
        </div>

        {/* Detalle tarjeta a tarjeta */}
        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--card-border)] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">
              Tarjetas revisadas
            </h2>
            <span className="text-xs text-neutral-500 tabular-nums">
              {sessionLog.length}
            </span>
          </div>
          <ul className="divide-y divide-[var(--card-border)] max-h-[50vh] overflow-y-auto">
            {sessionLog.map((e, i) => (
              <li
                key={`${e.simplified}-${i}`}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="text-xs text-neutral-600 tabular-nums w-6 text-right">
                  {i + 1}
                </span>
                <span className="text-2xl min-w-[2.5rem]">{e.simplified}</span>
                <span className="text-[var(--accent)] text-sm min-w-[5rem]">
                  {e.pinyin}
                </span>
                <span className="flex-1 text-neutral-400 text-xs truncate">
                  {e.translation_es || e.meanings_en || "—"}
                </span>
                <span className="text-xs text-neutral-500 tabular-nums w-14 text-right">
                  {(e.response_ms / 1000).toFixed(1)}s
                </span>
                <ResultBadge result={e.result} />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex gap-3 justify-center pb-6">
          <button
            onClick={() => {
              setStarted(false);
              setDone(false);
            }}
            className="px-6 py-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]"
          >
            Cambiar scopes
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]"
          >
            Inicio
          </Link>
        </div>
      </main>
    );
  }

  function Metric({
    label,
    value,
    tone,
  }: {
    label: string;
    value: string;
    tone: "green" | "amber" | "red" | "neutral";
  }) {
    const toneClass = {
      green: "text-green-400",
      amber: "text-amber-400",
      red: "text-red-400",
      neutral: "text-neutral-200",
    }[tone];
    return (
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 flex flex-col gap-0.5">
        <span className="text-[0.65rem] uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        <span className={`text-lg font-semibold tabular-nums ${toneClass}`}>
          {value}
        </span>
      </div>
    );
  }

  function ResultBadge({ result }: { result: Result }) {
    const map: Record<Result, { icon: string; cls: string }> = {
      known: { icon: "☑", cls: "text-green-400 border-green-500/40" },
      partial: { icon: "◐", cls: "text-amber-400 border-amber-500/40" },
      unknown: { icon: "☐", cls: "text-red-400 border-red-500/40" },
    };
    const { icon, cls } = map[result];
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded border text-sm ${cls}`}
      >
        {icon}
      </span>
    );
  }

  // Skip any due cards whose details weren't loaded (edge case: progress row
  // references a simplified not returned by /api/cards). Advance in an effect,
  // never during render, to avoid "Too many re-renders".
  const currentDue = dueCards[current];
  const currentCard = currentDue ? cardDetails.get(currentDue.simplified) : undefined;

  if (!currentCard) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 animate-pulse">Cargando tarjeta...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6 gap-3">
          <button
            type="button"
            onClick={() => setStarted(false)}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Cambiar scopes
          </button>
          <span
            className="text-xs text-neutral-500 truncate"
            title={selectedBlocks
              .map((id) => BLOCKS.find((b) => b.id === id)?.label ?? id)
              .join(" · ")}
          >
            {selectedBlocks.length} scope{selectedBlocks.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-3 text-sm">
            <span className="text-green-400">☑ {sessionStats.known}</span>
            <span className="text-amber-400">◐ {sessionStats.partial}</span>
            <span className="text-red-400">☐ {sessionStats.unknown}</span>
          </div>
        </div>
        <Flashcard
          card={currentCard}
          onResult={handleResult}
          index={current}
          total={dueCards.length}
          mode="practice"
        />
      </div>
    </main>
  );
}
