"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total_cards_seen: number;
  by_dx: Record<string, number>;
  due_today: number;
  reviews_today: Record<string, number>;
  total_reviews: number;
  streak: number;
  exams: Array<{
    id: number;
    name: string;
    scope: string;
    score_pct: number;
    known: number;
    partial: number;
    unknown: number;
    total_cards: number;
    created_at: string;
  }>;
}

const BLOCKS = [
  { id: "hsk2_l1", label: "HSK 2.0 — Nivel 1", desc: "156 ítems — base acumulativa" },
  { id: "hsk2_l2", label: "HSK 2.0 — Nivel 2", desc: "158 ítems — contenido del examen" },
  { id: "hsk3_l1_new", label: "HSK 3.0 L1 (nuevos)", desc: "~290 ítems fuera del HSK 2.0" },
  { id: "hsk3_l2_new", label: "HSK 3.0 L2 (nuevos)", desc: "~698 ítems — extensión UCD" },
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const todayReviews = stats
    ? Object.values(stats.reviews_today).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          汉字Flow <span className="text-[var(--accent)]">Quiz</span>
        </h1>
        <p className="text-neutral-400 mt-2">
          Diagnóstico HSK + Repetición Espaciada — Sprint al UCD
        </p>
      </header>

      {/* Stats strip */}
      {stats && stats.total_cards_seen > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-8">
          <Stat label="Vistas" value={stats.total_cards_seen} />
          <Stat label="Hoy" value={todayReviews} />
          <Stat label="Pendientes" value={stats.due_today} accent />
          <Stat label="Racha" value={`${stats.streak}d`} />
        </div>
      )}

      {/* Mode cards */}
      <section className="space-y-4 mb-10">
        <h2 className="text-lg font-semibold text-neutral-300">Modos</h2>

        <Link href="/diagnostic" className="block">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 hover:border-[var(--accent)] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h3 className="font-semibold">Diagnóstico</h3>
                <p className="text-sm text-neutral-400">
                  Primera pasada — marca cada tarjeta como ☑ / ◐ / ☐. Selecciona bloque HSK.
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link
          href="/practice"
          className="block"
        >
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <h3 className="font-semibold">Práctica SRS</h3>
                <p className="text-sm text-neutral-400">
                  Repaso diario — tarjetas pendientes por repetición espaciada (SM-2).
                  {stats && stats.due_today > 0 && (
                    <span className="text-amber-400 ml-1">
                      {stats.due_today} pendientes hoy
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dictado" className="block">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 hover:border-amber-500/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎧</span>
              <div>
                <h3 className="font-semibold">Dictado</h3>
                <p className="text-sm text-neutral-400">
                  Audio → pinyin → hanzi. Productivo, no recognition. Bloques HSK 2.0 y 3.0.
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/exam" className="block">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 hover:border-purple-500/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-semibold">Examen</h3>
                <p className="text-sm text-neutral-400">
                  Snapshot de evaluación — puntaje guardado para medir avance.
                </p>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* Block selector for reference */}
      <section className="space-y-3 mb-10">
        <h2 className="text-lg font-semibold text-neutral-300">Bloques HSK</h2>
        <div className="grid grid-cols-2 gap-3">
          {BLOCKS.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
            >
              <p className="font-medium text-sm">{b.label}</p>
              <p className="text-xs text-neutral-500">{b.desc}</p>
              {stats && stats.by_dx && (
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-green-400">
                    ☑ {stats.by_dx.known || 0}
                  </span>
                  <span className="text-xs text-amber-400">
                    ◐ {stats.by_dx.partial || 0}
                  </span>
                  <span className="text-xs text-red-400">
                    ☐ {stats.by_dx.unknown || 0}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Exam history */}
      {stats && stats.exams && stats.exams.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-300">
            Historial de exámenes
          </h2>
          <div className="space-y-2">
            {stats.exams.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3"
              >
                <div>
                  <p className="text-sm font-medium">{ex.name}</p>
                  <p className="text-xs text-neutral-500">
                    {ex.scope} · {new Date(ex.created_at).toLocaleDateString("es-MX")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{ex.score_pct}%</p>
                  <p className="text-xs text-neutral-500">
                    {ex.known}☑ {ex.partial}◐ {ex.unknown}☐
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-center">
      <p
        className={`text-2xl font-bold tabular-nums ${accent ? "text-amber-400" : ""}`}
      >
        {value}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
