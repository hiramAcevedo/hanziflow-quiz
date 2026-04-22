import Link from "next/link";
import { notFound } from "next/navigation";
import ItemLoop from "@/components/dictado/item-loop";
import { isCnVoice, isSupportedScope, DEFAULT_VOICE } from "@/lib/audio-urls";
import { loadDictadoScope } from "@/lib/dictado-data";

const DEFAULT_BLOCK_SIZE = 30;

interface Props {
  params: Promise<{ scope: string; block: string }>;
  searchParams: Promise<{ size?: string; voice?: string; shuffle?: string }>;
}

export default async function BlockPage({ params, searchParams }: Props) {
  const { scope, block } = await params;
  const sp = await searchParams;
  if (!isSupportedScope(scope)) notFound();

  const blockNum = Number(block);
  if (!Number.isInteger(blockNum) || blockNum < 1) notFound();

  const size = Math.max(5, Math.min(100, Number(sp.size) || DEFAULT_BLOCK_SIZE));
  const voice = isCnVoice(sp.voice ?? "") ? (sp.voice as "corta" | "larga" | "neutral") : DEFAULT_VOICE;
  const shuffle = sp.shuffle === "1";

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
  const start = (blockNum - 1) * size;
  const end = Math.min(blockNum * size, entries.length);
  let items = entries.slice(start, end);
  if (items.length === 0) notFound();
  if (shuffle) {
    // Shuffle server-side: cada visita re-baraja. El rango start–end y el
    // numero de bloque se mantienen como ancla de progreso.
    items = [...items].sort(() => Math.random() - 0.5);
  }

  const totalBlocks = Math.ceil(entries.length / size);
  const nextBlockSuffix = shuffle ? "&shuffle=1" : "";
  const nextBlockHref =
    blockNum < totalBlocks
      ? `/dictado/${scope}/${blockNum + 1}?size=${size}&voice=${voice}${nextBlockSuffix}`
      : null;

  return (
    <main className="min-h-screen p-4 pt-8 max-w-2xl mx-auto flex flex-col">
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`/dictado/${scope}?size=${size}&voice=${voice}`}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← Bloques
        </Link>
        <p className="text-xs text-neutral-500 tabular-nums">
          {scope} · bloque {blockNum}/{totalBlocks} · {start + 1}–{end}
          {shuffle && <span className="ml-1 text-[var(--accent)]">· 🎲</span>}
        </p>
        <Link
          href={`/dictado/${scope}/${blockNum}?size=${size}&voice=${voice}${shuffle ? "" : "&shuffle=1"}`}
          title={shuffle ? "Desactivar orden aleatorio" : "Barajar el orden del bloque"}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            shuffle
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--card-border)] text-neutral-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          }`}
        >
          🎲
        </Link>
      </header>

      <ItemLoop
        scope={scope}
        initialVoice={voice}
        items={items}
        blockLabel={`${scope} · bloque ${blockNum} (${start + 1}–${end})`}
        nextBlockHref={nextBlockHref}
      />
    </main>
  );
}
