"use client";

import { useState, useEffect, useCallback } from "react";
import Flashcard, { type CardData } from "@/components/flashcard";
import Link from "next/link";

const BLOCKS = [
  { id: "hsk2_l1", label: "HSK 2.0 L1", scope: "hsk2.0_l1" },
  { id: "hsk2_l2", label: "HSK 2.0 L1+L2", scope: "hsk2.0_l1l2" },
  { id: "hsk3_l1_new", label: "HSK 3.0 L1 completo", scope: "hsk3.0_l1" },
  { id: "hsk3_l2_new", label: "HSK 3.0 L2 (nuevos)", scope: "hsk3.0_l2_new" },
];

type Result = "known" | "partial" | "unknown";

export default function ExamPage() {
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState({ known: 0, partial: 0, unknown: 0 });
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [examName, setExamName] = useState("");

  async function startExam() {
    if (selectedBlocks.length === 0) return;
    setLoading(true);

    try {
      const allCards: CardData[] = [];
      const seen = new Set<string>();

      for (const blockId of selectedBlocks) {
        const res = await fetch(`/api/cards?block=${blockId}`);
        if (!res.ok) throw new Error(`Failed to load ${blockId}`);
        const data = await res.json();
        for (const c of data.cards ?? []) {
          if (!seen.has(c.simplified)) {
            seen.add(c.simplified);
            allCards.push(c);
          }
        }
      }

      if (allCards.length === 0) {
        alert("No se obtuvieron tarjetas para los bloques seleccionados.");
        return;
      }

      const shuffled = allCards.sort(() => Math.random() - 0.5);
      setCards(shuffled);
      setCurrent(0);
      setResults({ known: 0, partial: 0, unknown: 0 });
      setStarted(true);
      setDone(false);
      setSaved(false);
    } catch (err) {
      console.error(err);
      alert("Error cargando tarjetas. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  }

  const handleResult = useCallback(
    async (result: Result, responseMs: number) => {
      if (!cards[current]) return;

      // Log to server (as exam mode)
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simplified: cards[current].simplified,
          result,
          mode: "exam",
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

  async function saveExam() {
    const total = results.known + results.partial + results.unknown;
    const scope = selectedBlocks.join("+");

    await fetch("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: examName || `Examen ${new Date().toLocaleDateString("es-MX")}`,
        scope,
        total_cards: total,
        known: results.known,
        partial: results.partial,
        unknown: results.unknown,
      }),
    });

    setSaved(true);
  }

  // Block selector
  if (!started) {
    return (
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300 mb-6 inline-block"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold mb-2">Examen</h1>
        <p className="text-neutral-400 mb-6">
          Snapshot de evaluación — las tarjetas se barajan y el resultado se guarda
          como punto de referencia para medir avance.
        </p>

        <div className="mb-6">
          <label className="text-sm text-neutral-400 block mb-2">
            Nombre del examen (opcional)
          </label>
          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            placeholder={`Examen ${new Date().toLocaleDateString("es-MX")}`}
            className="w-full px-4 py-3 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-white placeholder:text-neutral-600 focus:border-[var(--accent)] outline-none"
          />
        </div>

        <div className="space-y-3 mb-8">
          <p className="text-sm text-neutral-400">Selecciona bloques a evaluar:</p>
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

        <button
          onClick={startExam}
          disabled={selectedBlocks.length === 0 || loading}
          className="w-full py-4 rounded-xl bg-[var(--accent)] text-white font-semibold text-lg
                     disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {loading ? "Cargando..." : "Iniciar examen"}
        </button>
      </main>
    );
  }

  // Done
  if (done) {
    const total = results.known + results.partial + results.unknown;
    const score =
      total > 0
        ? Math.round(((results.known + results.partial * 0.5) / total) * 100)
        : 0;

    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col items-center justify-center gap-6">
        <h1 className="text-2xl font-bold">Examen completado</h1>
        <div className="text-7xl font-bold">{score}%</div>
        <div className="flex gap-6 text-lg">
          <span className="text-green-400">☑ {results.known}</span>
          <span className="text-amber-400">◐ {results.partial}</span>
          <span className="text-red-400">☐ {results.unknown}</span>
        </div>
        <p className="text-neutral-400">{total} tarjetas evaluadas</p>

        {!saved ? (
          <button
            onClick={saveExam}
            className="px-8 py-3 rounded-xl bg-purple-600 text-white font-medium hover:opacity-90"
          >
            Guardar resultado
          </button>
        ) : (
          <p className="text-green-400">✓ Resultado guardado</p>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={() => {
              setStarted(false);
              setDone(false);
            }}
            className="px-6 py-3 rounded-xl border border-[var(--card-border)]"
          >
            Nuevo examen
          </button>
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

  if (loading || cards.length === 0 || !cards[current]) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 animate-pulse">Cargando examen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-neutral-500">Examen en curso</span>
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
          mode="exam"
        />
      </div>
    </main>
  );
}
