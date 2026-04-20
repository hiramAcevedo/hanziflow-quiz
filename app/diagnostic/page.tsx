"use client";

import { useState, useEffect, useCallback } from "react";
import Flashcard, { type CardData } from "@/components/flashcard";
import Link from "next/link";

const BLOCKS = [
  { id: "hsk2_l1", label: "HSK 2.0 — Nivel 1", desc: "Base acumulativa (156)" },
  { id: "hsk2_l2", label: "HSK 2.0 — Nivel 2", desc: "Contenido examen (158)" },
  { id: "hsk3_l1_new", label: "HSK 3.0 L1 (nuevos)", desc: "No cubierto por HSK 2.0" },
  { id: "hsk3_l2_new", label: "HSK 3.0 L2 (nuevos)", desc: "Extensión UCD" },
];

type Result = "known" | "partial" | "unknown";

interface Results {
  known: number;
  partial: number;
  unknown: number;
}

export default function DiagnosticPage() {
  const [block, setBlock] = useState<string | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<Results>({ known: 0, partial: 0, unknown: 0 });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!block) return;
    setLoading(true);
    fetch(`/api/cards?block=${block}`)
      .then((r) => {
        if (!r.ok) throw new Error(`cards fetch failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setCards(data.cards ?? []);
        setCurrent(0);
        setResults({ known: 0, partial: 0, unknown: 0 });
        setDone(false);
      })
      .catch((err) => {
        console.error(err);
        setCards([]);
      })
      .finally(() => setLoading(false));
  }, [block]);

  const handleResult = useCallback(
    async (result: Result, responseMs: number) => {
      if (!cards[current]) return;

      // Record to server
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simplified: cards[current].simplified,
          result,
          mode: "diagnostic",
          response_ms: responseMs,
        }),
      });

      setResults((prev) => ({ ...prev, [result]: prev[result] + 1 }));

      if (current + 1 >= cards.length) {
        setDone(true);
      } else {
        setCurrent((c) => c + 1);
      }
    },
    [cards, current]
  );

  // Block selector
  if (!block) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300 mb-6 inline-block">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold mb-2">Diagnóstico</h1>
        <p className="text-neutral-400 mb-8">
          Selecciona un bloque para diagnosticar. Verás cada hanzi sin pinyin — voltea para verificar y marca tu nivel.
        </p>
        <div className="space-y-3">
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBlock(b.id)}
              className="w-full text-left rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 hover:border-[var(--accent)] transition-colors"
            >
              <h3 className="font-semibold">{b.label}</h3>
              <p className="text-sm text-neutral-400">{b.desc}</p>
            </button>
          ))}
          <button
            onClick={() => setBlock("all")}
            className="w-full text-left rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 hover:border-purple-500/50 transition-colors"
          >
            <h3 className="font-semibold">Todos los bloques</h3>
            <p className="text-sm text-neutral-400">Diagnóstico completo (~1.300 ítems)</p>
          </button>
        </div>
      </main>
    );
  }

  if (loading || cards.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 animate-pulse">Cargando tarjetas...</p>
      </main>
    );
  }

  // Completed
  if (done) {
    const total = results.known + results.partial + results.unknown;
    const score =
      total > 0
        ? Math.round(((results.known + results.partial * 0.5) / total) * 100)
        : 0;

    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col items-center justify-center gap-6">
        <h1 className="text-2xl font-bold">Diagnóstico completado</h1>
        <div className="text-6xl font-bold">{score}%</div>
        <div className="flex gap-6 text-lg">
          <span className="text-green-400">☑ {results.known}</span>
          <span className="text-amber-400">◐ {results.partial}</span>
          <span className="text-red-400">☐ {results.unknown}</span>
        </div>
        <p className="text-neutral-400 text-center">
          {results.known} de {total} reconocidos en hanzi.
          {results.partial > 0 && ` ${results.partial} necesitan transición pinyin→hanzi.`}
          {results.unknown > 0 && ` ${results.unknown} por aprender.`}
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setBlock(null);
            }}
            className="px-6 py-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)] transition-colors"
          >
            Otro bloque
          </button>
          <Link
            href="/practice"
            className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Iniciar SRS →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setBlock(null)}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Cambiar bloque
          </button>
          <div className="flex gap-3 text-sm">
            <span className="text-green-400">☑ {results.known}</span>
            <span className="text-amber-400">◐ {results.partial}</span>
            <span className="text-red-400">☐ {results.unknown}</span>
          </div>
        </div>
        <Flashcard
          card={cards[current]}
          onResult={handleResult}
          index={current}
          total={cards.length}
          mode="diagnostic"
        />
      </div>
    </main>
  );
}
