"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface PickerItem {
  key: string;
  href: string;
  /** Contenido de la tarjeta. Usa `group-hover:` y `group-data-[hi=true]:`
   *  para que el highlight del roll se vea igual que el hover normal. */
  node: React.ReactNode;
}

interface Props {
  heading: string;
  items: PickerItem[];
  listClassName: string;
  buttonIdleLabel: string;
  buttonTitle?: string;
}

// Paleta para ciclar el contorno durante el roll. Cada tick elige una distinta
// (evita repetir la última) para que se vea vivo. La última — la elegida —
// se queda fija mientras se navega.
const ROLL_COLORS = [
  "#60a5fa", // blue
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
  "#c084fc", // purple
  "#22d3ee", // cyan
  "#fb7185", // rose
];

export default function RandomPicker({
  heading,
  items,
  listClassName,
  buttonIdleLabel,
  buttonTitle,
}: Props) {
  const router = useRouter();
  const [rolling, setRolling] = useState(false);
  const [hi, setHi] = useState<number | null>(null);
  const [color, setColor] = useState<string>(ROLL_COLORS[0]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const roll = () => {
    if (rolling || items.length === 0) return;
    setRolling(true);

    // Roll corto pero legible: aprox 10 saltos antes de aterrizar.
    const rollMs = 650;
    const tick = 60;
    const start = Date.now();
    let lastIdx = -1;
    let lastColor = -1;

    const cycle = () => {
      const elapsed = Date.now() - start;
      let i = Math.floor(Math.random() * items.length);
      if (items.length > 1 && i === lastIdx) i = (i + 1) % items.length;
      lastIdx = i;
      let c = Math.floor(Math.random() * ROLL_COLORS.length);
      if (c === lastColor) c = (c + 1) % ROLL_COLORS.length;
      lastColor = c;
      setHi(i);
      setColor(ROLL_COLORS[c]);
      if (elapsed < rollMs) {
        timers.current.push(setTimeout(cycle, tick));
      } else {
        // Decisión final + pausa para que el ojo registre.
        const finalIdx = Math.floor(Math.random() * items.length);
        const finalColor = ROLL_COLORS[Math.floor(Math.random() * ROLL_COLORS.length)];
        setHi(finalIdx);
        setColor(finalColor);
        timers.current.push(
          setTimeout(() => {
            router.push(items[finalIdx].href);
          }, 420)
        );
      }
    };
    cycle();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
          {heading}
        </h2>
        <button
          type="button"
          title={buttonTitle}
          disabled={rolling || items.length === 0}
          onClick={roll}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--card-border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-70"
        >
          <span className={rolling ? "inline-block animate-bounce" : ""}>🎲</span>{" "}
          {buttonIdleLabel}
        </button>
      </div>
      <div className={listClassName}>
        {items.map((item, i) => (
          <Link
            key={item.key}
            href={item.href}
            data-hi={hi === i ? "true" : undefined}
            style={
              hi === i
                ? ({ "--hi-color": color } as React.CSSProperties)
                : undefined
            }
            className="group block"
          >
            {item.node}
          </Link>
        ))}
      </div>
    </>
  );
}
