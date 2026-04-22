import Link from "next/link";
import { SUPPORTED_SCOPES } from "@/lib/audio-urls";
import { loadDictadoScope } from "@/lib/dictado-data";
import RandomPicker from "@/components/dictado/random-picker";

const SCOPE_LABELS: Record<string, string> = {
  "hsk2.0_l1": "HSK 2.0 — Nivel 1",
  "hsk2.0_l2": "HSK 2.0 — Nivel 2",
  "hsk3.0_l1": "HSK 3.0 — Nivel 1",
};

export default async function DictadoLanding() {
  const scopes = SUPPORTED_SCOPES.map((scope) => {
    try {
      const entries = loadDictadoScope(scope);
      return { scope, label: SCOPE_LABELS[scope] ?? scope, count: entries.length };
    } catch {
      return { scope, label: SCOPE_LABELS[scope] ?? scope, count: null as number | null };
    }
  });

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Inicio
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">
          Modo <span className="text-[var(--accent)]">Dictado</span>
        </h1>
        <p className="text-neutral-400 mt-2 text-sm">
          Escucha → escribe pinyin → dibuja hanzi → reveal. Productivo, no recognition.
        </p>
      </header>

      <section>
        <RandomPicker
          heading="Elige un scope"
          listClassName="space-y-3"
          buttonIdleLabel="Scope al azar"
          buttonTitle="Ir a un scope al azar"
          items={scopes.map((s) => ({
            key: s.scope,
            href: `/dictado/${s.scope}`,
            node: (
              <div className="rounded-xl border border-[var(--card-border)] group-hover:border-[var(--accent)] group-data-[hi=true]:border-[color:var(--hi-color)] bg-[var(--card-bg)] p-5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{s.label}</h3>
                    <p className="text-xs text-neutral-500 mt-1">{s.scope}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums">{s.count ?? "—"}</p>
                    <p className="text-xs text-neutral-500">ítems</p>
                  </div>
                </div>
              </div>
            ),
          }))}
        />
      </section>
    </main>
  );
}
