import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupportedScope } from "@/lib/audio-urls";
import { loadDictadoScope } from "@/lib/dictado-data";
import RandomPicker from "@/components/dictado/random-picker";

const SCOPE_LABELS: Record<string, string> = {
  "hsk2.0_l1": "HSK 2.0 — Nivel 1",
  "hsk2.0_l2": "HSK 2.0 — Nivel 2",
  "hsk3.0_l1": "HSK 3.0 — Nivel 1",
};

const DEFAULT_BLOCK_SIZE = 30;

interface Props {
  params: Promise<{ scope: string }>;
  searchParams: Promise<{ size?: string; voice?: string }>;
}

export default async function ScopeBlocksPage({ params, searchParams }: Props) {
  const { scope } = await params;
  const sp = await searchParams;
  if (!isSupportedScope(scope)) notFound();

  const size = Math.max(5, Math.min(100, Number(sp.size) || DEFAULT_BLOCK_SIZE));
  const voice = sp.voice ?? "larga";

  let entries;
  try {
    entries = loadDictadoScope(scope);
  } catch {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <p className="text-red-400">Error cargando scope {scope}.</p>
      </main>
    );
  }
  const total = entries.length;
  const numBlocks = Math.ceil(total / size);
  const blocks = Array.from({ length: numBlocks }, (_, i) => {
    const start = i * size + 1;
    const end = Math.min((i + 1) * size, total);
    return { n: i + 1, start, end };
  });

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link href="/dictado" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Scopes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">
          {SCOPE_LABELS[scope] ?? scope}
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          {total} ítems · bloques de {size} · voz {voice}
        </p>
      </header>

      <RandomPicker
        heading="Bloques"
        listClassName="grid grid-cols-2 sm:grid-cols-3 gap-2"
        buttonIdleLabel="Bloque al azar"
        buttonTitle="Ir a un bloque al azar (con orden aleatorio)"
        items={blocks.map((b) => ({
          key: String(b.n),
          href: `/dictado/${scope}/${b.n}?size=${size}&voice=${voice}&shuffle=1`,
          node: (
            <div className="rounded-lg border border-[var(--card-border)] group-hover:border-[var(--accent)] group-data-[hi=true]:border-[color:var(--hi-color)] bg-[var(--card-bg)] p-3 text-center transition-colors">
              <p className="text-xs text-neutral-500">Bloque {b.n}</p>
              <p className="text-sm font-medium tabular-nums mt-1">
                {b.start}–{b.end}
              </p>
            </div>
          ),
        }))}
      />
    </main>
  );
}
