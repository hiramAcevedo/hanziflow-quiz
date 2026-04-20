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

export default function PracticePage() {
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [cardDetails, setCardDetails] = useState<Map<string, CardData>>(new Map());
  const [current, setCurrent] = useState(0);
  const [sessionStats, setSessionStats] = useState({ known: 0, partial: 0, unknown: 0 });
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

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

  // Load due cards
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const dueRes = await fetch("/api/progress?limit=200");
        if (!dueRes.ok) throw new Error("due fetch failed");
        const dueData = await dueRes.json();
        const due: DueCard[] = dueData.due ?? [];

        if (due.length === 0) {
          setDueCards([]);
          return;
        }

        const shuffled = [...due].sort(() => Math.random() - 0.5);
        setDueCards(shuffled);

        const allRes = await fetch("/api/cards");
        if (!allRes.ok) throw new Error("cards fetch failed");
        const allCards = await allRes.json();
        const map = new Map<string, CardData>();
        for (const c of allCards.cards ?? []) {
          map.set(c.simplified, c);
        }
        setCardDetails(map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleResult = useCallback(
    async (result: Result, responseMs: number) => {
      const card = dueCards[current];
      if (!card) return;

      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simplified: card.simplified,
          result,
          mode: "practice",
          response_ms: responseMs,
        }),
      });

      setSessionStats((prev) => ({ ...prev, [result]: prev[result] + 1 }));

      if (current + 1 >= dueCards.length) {
        setDone(true);
      } else {
        setCurrent((c) => c + 1);
      }
    },
    [dueCards, current]
  );

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
          No hay tarjetas programadas para hoy. Haz un diagnóstico primero para
          alimentar la cola de repetición, o vuelve mañana.
        </p>
        <div className="flex gap-3">
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
    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col items-center justify-center gap-6">
        <span className="text-6xl">✅</span>
        <h1 className="text-2xl font-bold">Sesión SRS completada</h1>
        <div className="flex gap-6 text-lg">
          <span className="text-green-400">☑ {sessionStats.known}</span>
          <span className="text-amber-400">◐ {sessionStats.partial}</span>
          <span className="text-red-400">☐ {sessionStats.unknown}</span>
        </div>
        <p className="text-neutral-400">{total} tarjetas revisadas hoy.</p>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]"
        >
          Volver al inicio
        </Link>
      </main>
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
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← Inicio
          </Link>
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
