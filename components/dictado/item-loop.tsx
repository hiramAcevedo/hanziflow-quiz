"use client";

import { useEffect, useMemo, useState } from "react";
import AudioPlayer from "./audio-player";
import PinyinInput from "./pinyin-input";
import HanziCanvas, { type HanziDifficulty } from "./hanzi-canvas";
import RevealPanel from "./reveal-panel";
import { entryId } from "@/lib/entry-id";
import {
  cnAudioUrl,
  sentAudioUrl,
  sentEsAudioUrl,
  CN_VOICES,
  type CnVoice,
  type Scope,
} from "@/lib/audio-urls";
import { pinyinEquals } from "@/lib/pinyin-tones";

export interface DictadoItem {
  simplified: string;
  pinyin: string;
  meanings_en: string[];
  translation_es: string | null;
  example_zh: string | null;
  example_es: string | null;
}

type Phase = "intro" | "pinyin" | "hanzi" | "reveal" | "done";

interface Props {
  scope: Scope;
  initialVoice: CnVoice;
  items: DictadoItem[];
  blockLabel: string;
  nextBlockHref: string | null;
}

interface Result {
  simplified: string;
  pinyin_ok: boolean;
  hanzi_ok: boolean;
  skipped: boolean;
}

const DIFFICULTY_LABELS: Record<HanziDifficulty, string> = {
  outline: "Contorno",
  hint: "Hint",
  blank: "Sin ayuda",
};
const DIFFICULTY_KEY: Record<HanziDifficulty, string> = {
  outline: "⌥C",
  hint: "⌥H",
  blank: "⌥N",
};

export default function ItemLoop({
  scope,
  initialVoice,
  items,
  blockLabel,
  nextBlockHref,
}: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [pinyinOk, setPinyinOk] = useState<boolean | null>(null);
  const [pinyinAttempt, setPinyinAttempt] = useState<{ composed: string; raw: string; ok: boolean } | null>(null);
  const [pinyinTries, setPinyinTries] = useState(0);
  const [hanziOk, setHanziOk] = useState<boolean | null>(null);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [results, setResults] = useState<Result[]>([]);
  const [voice, setVoice] = useState<CnVoice>(initialVoice);
  const [difficulty, setDifficulty] = useState<HanziDifficulty>("outline");
  const [fastAdvance, setFastAdvance] = useState(false);
  const [showSentencePinyin, setShowSentencePinyin] = useState(false);
  const [playToken, setPlayToken] = useState(0);

  // Preferencia persistida: pinyin de oración siempre visible en el reveal.
  useEffect(() => {
    try {
      if (localStorage.getItem("hanziflow.dictado.sentencePinyin") === "1") {
        setShowSentencePinyin(true);
      }
    } catch {
      // ignore
    }
  }, []);
  const toggleSentencePinyin = (next: boolean) => {
    setShowSentencePinyin(next);
    try {
      localStorage.setItem("hanziflow.dictado.sentencePinyin", next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const current = items[index];
  const eid = useMemo(() => (current ? entryId(current.simplified) : ""), [current]);

  if (!current) {
    return <p className="text-center text-neutral-400">Este bloque está vacío.</p>;
  }

  if (phase === "done") {
    const pinyinHits = results.filter((r) => r.pinyin_ok).length;
    const hanziHits = results.filter((r) => r.hanzi_ok).length;
    return (
      <div className="text-center space-y-6 py-10">
        <h2 className="text-2xl font-semibold">Bloque completado</h2>
        <p className="text-neutral-400">{blockLabel}</p>
        <div className="text-4xl tabular-nums">
          <span className="text-green-400">{pinyinHits}</span>
          <span className="text-neutral-500">/{results.length}</span>
          <span className="text-neutral-600 mx-3">·</span>
          <span className="text-green-400">{hanziHits}</span>
          <span className="text-neutral-500">/{results.length}</span>
        </div>
        <p className="text-xs text-neutral-500">pinyin · hanzi</p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <a
            href="/dictado"
            className="px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]"
          >
            Inicio
          </a>
          {nextBlockHref && (
            <a
              href={nextBlockHref}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium"
            >
              Siguiente bloque →
            </a>
          )}
        </div>
      </div>
    );
  }

  const cnUrl = cnAudioUrl(scope, voice, eid);
  const sentCnUrl = sentAudioUrl(scope, voice, eid);
  const sentEsUrl = sentEsAudioUrl(scope, eid);

  const goNext = (finalPinyinOk: boolean, finalHanziOk: boolean, skipped = false, grade?: string) => {
    const next: Result = {
      simplified: current.simplified,
      pinyin_ok: finalPinyinOk,
      hanzi_ok: finalHanziOk,
      skipped,
    };
    setResults((arr) => [...arr, next]);

    try {
      fetch("/api/dictado/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          simplified: current.simplified,
          pinyin_ok: finalPinyinOk,
          hanzi_ok: finalHanziOk,
          self_grade: grade ?? null,
          pinyin_input: pinyinAttempt?.raw ?? null,
          response_ms: Date.now() - startedAt,
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }

    setPinyinOk(null);
    setHanziOk(null);
    setPinyinAttempt(null);
    setPinyinTries(0);

    if (index + 1 >= items.length) {
      setPhase("done");
      return;
    }
    setIndex(index + 1);
    setPhase("intro");
    setStartedAt(Date.now());
  };

  const handlePinyinSubmit = (composed: string, raw: string) => {
    const ok = pinyinEquals(composed, current.pinyin) || pinyinEquals(raw, current.pinyin);
    const nextTries = pinyinTries + 1;
    setPinyinAttempt({ composed, raw, ok });
    setPinyinTries(nextTries);
    // Gracia: primer fallo deja el input abierto para reintentar. Correcto o
    // segundo fallo cierra el estado y habilita el avance.
    if (ok || nextTries >= 2) {
      setPinyinOk(ok);
    }
  };

  const advanceToHanzi = () => setPhase("hanzi");
  const advanceToReveal = () => setPhase("reveal");

  // `fastAdvance` ON: tras validar pinyin, saltamos el panel intermedio y vamos
  // directo a hanzi. OFF (default): se muestra el panel intermedio con el
  // resultado; el usuario puede quedarse pensando o reescuchando el audio, y
  // avanza con Enter o click.
  useEffect(() => {
    if (!fastAdvance) return;
    if (phase !== "pinyin" || pinyinOk === null) return;
    advanceToHanzi();
  }, [phase, pinyinOk, fastAdvance]);

  // Shortcuts globales. Enter = botón primario de la fase actual. Las letras
  // requieren Alt/Option para no pisar la escritura de pinyin; números sin
  // modificador sólo se capturan en reveal (PinyinInput no está montado ahí).
  //   Enter     → avanzar
  //   Alt+R     → repetir audio principal
  //   Alt+C/H/N → dificultad hanzi (Contorno / Hint / Sin ayuda)
  //   Alt+S     → "No sé" (salta directo al reveal desde intro o hanzi)
  //   Alt+P     → switch global pinyin de oración
  //   Alt+F     → switch "saltar panel pinyin" (fast advance)
  //   Alt+1/2/3 → voz corta / larga / neutral
  //   1/2/3/4   → self-grade en reveal (otra vez / difícil / bien / fácil)
  // Usamos `e.code` (KeyR, Digit1, ...) en vez de `e.key` porque Option+letra
  // en Mac produce caracteres especiales (Option+R = ®, Option+N = dead key).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Enter sin modificadores.
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (phase === "intro") {
          e.preventDefault();
          setPhase("pinyin");
          return;
        }
        // Enter sólo avanza si la respuesta fue correcta. Si fue incorrecta,
        // el usuario debe click en "Dibujar hanzi →" conscientemente — evita
        // que un Enter "auto-pase" wrong answers sin darse cuenta.
        if (phase === "pinyin" && pinyinOk === true && !fastAdvance) {
          e.preventDefault();
          advanceToHanzi();
          return;
        }
        if (phase === "hanzi" && hanziOk !== null) {
          e.preventDefault();
          advanceToReveal();
          return;
        }
        if (phase === "reveal") {
          e.preventDefault();
          goNext(
            pinyinOk === true,
            hanziOk === true,
            pinyinOk === null && hanziOk === null,
            "good"
          );
          return;
        }
        return;
      }

      // Self-grade en reveal: 1/2/3/4 sin modificadores.
      if (
        phase === "reveal" &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey
      ) {
        const grades: Record<string, "again" | "hard" | "good" | "easy"> = {
          Digit1: "again",
          Numpad1: "again",
          Digit2: "hard",
          Numpad2: "hard",
          Digit3: "good",
          Numpad3: "good",
          Digit4: "easy",
          Numpad4: "easy",
        };
        const g = grades[e.code];
        if (g) {
          e.preventDefault();
          goNext(pinyinOk === true, hanziOk === true, false, g);
          return;
        }
      }

      // Alt+X — solo Alt, sin Cmd/Ctrl/Shift.
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.code === "KeyR") {
        e.preventDefault();
        setPlayToken((t) => t + 1);
        return;
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        setDifficulty("outline");
        return;
      }
      if (e.code === "KeyH") {
        e.preventDefault();
        setDifficulty("hint");
        return;
      }
      if (e.code === "KeyN") {
        e.preventDefault();
        setDifficulty("blank");
        return;
      }
      if (e.code === "KeyS") {
        // "No sé" — salta directo al reveal.
        if (phase === "intro") {
          e.preventDefault();
          setPinyinOk(false);
          setHanziOk(false);
          setPhase("reveal");
          return;
        }
        if (phase === "hanzi") {
          e.preventDefault();
          setHanziOk(false);
          advanceToReveal();
          return;
        }
        return;
      }
      if (e.code === "KeyP") {
        e.preventDefault();
        toggleSentencePinyin(!showSentencePinyin);
        return;
      }
      if (e.code === "KeyF") {
        e.preventDefault();
        setFastAdvance((f) => !f);
        return;
      }
      if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        setVoice("corta");
        return;
      }
      if (e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        setVoice("larga");
        return;
      }
      if (e.code === "Digit3" || e.code === "Numpad3") {
        e.preventDefault();
        setVoice("neutral");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pinyinOk, hanziOk, fastAdvance, showSentencePinyin]);

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="truncate">{blockLabel}</span>
        <span className="tabular-nums">
          {index + 1} / {items.length}
        </span>
      </div>

      {/* Controles globales: voz + dificultad hanzi */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Voz</span>
          <div className="flex gap-1">
            {CN_VOICES.map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setVoice(v)}
                title={`Tecla: ⌥${i + 1}`}
                className={`px-2 py-1 rounded border ${
                  voice === v
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-[var(--card-border)] hover:border-neutral-500"
                }`}
              >
                {v}{" "}
                <span className="text-[0.6rem] text-neutral-500">(⌥{i + 1})</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Hanzi</span>
          <div className="flex gap-1">
            {(Object.keys(DIFFICULTY_LABELS) as HanziDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                title={`Tecla: ${DIFFICULTY_KEY[d]}`}
                className={`px-2 py-1 rounded border ${
                  difficulty === d
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-[var(--card-border)] hover:border-neutral-500"
                }`}
              >
                {DIFFICULTY_LABELS[d]}{" "}
                <span className="text-[0.6rem] text-neutral-500">({DIFFICULTY_KEY[d]})</span>
              </button>
            ))}
          </div>
        </div>
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none"
          title="Si se activa, tras validar pinyin se salta el panel intermedio y se va directo a dibujar hanzi."
        >
          <input
            type="checkbox"
            checked={fastAdvance}
            onChange={(e) => setFastAdvance(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-neutral-400">
            Saltar panel pinyin <span className="text-[0.6rem] text-neutral-500">(⌥F)</span>
          </span>
        </label>
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none"
          title="Muestra siempre el pinyin sobre la oración en el reveal. Si está apagado, se puede revelar puntualmente tocando la oración o con ⌥O."
        >
          <input
            type="checkbox"
            checked={showSentencePinyin}
            onChange={(e) => toggleSentencePinyin(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-neutral-400">
            Pinyin oración <span className="text-[0.6rem] text-neutral-500">(⌥P)</span>
          </span>
        </label>
      </div>

      <div className="flex-1 flex flex-col justify-center pb-[45vh]">

      {phase === "intro" && (
        <div className="space-y-6 py-8 text-center">
          <p className="text-sm text-neutral-400">Escucha el audio y avanza cuando estés listo.</p>
          <AudioPlayer src={cnUrl} autoPlay label="▶ Repetir (⌥R)" className="justify-center" playToken={playToken} />
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => setPhase("pinyin")}
              className="px-5 py-3 rounded-lg bg-[var(--accent)] text-white font-medium"
              title="Enter"
            >
              Empezar pinyin (Enter)
            </button>
            <button
              type="button"
              onClick={() => {
                setPinyinOk(false);
                setHanziOk(false);
                setPhase("reveal");
              }}
              className="px-4 py-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-neutral-400 hover:text-neutral-200"
              title="⌥S"
            >
              No sé — revelar (⌥S)
            </button>
          </div>
        </div>
      )}

      {phase === "pinyin" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <AudioPlayer src={cnUrl} label="▶ Repetir audio (⌥R)" playToken={playToken} />
          </div>
          <PinyinInput
            key={`${index}-${pinyinTries}`}
            onSubmit={handlePinyinSubmit}
            disabled={pinyinOk !== null}
          />
          {pinyinAttempt && pinyinOk === null && !pinyinAttempt.ok && (
            <div className="rounded-lg border border-amber-600 bg-amber-500/10 text-amber-400 p-3 text-sm">
              ✗ Incorrecto. Último intento — inténtalo de nuevo.
            </div>
          )}
          {pinyinOk !== null && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                pinyinOk
                  ? "border-green-600 bg-green-500/10 text-green-400"
                  : "border-red-600 bg-red-500/10 text-red-400"
              }`}
            >
              {pinyinOk ? "✓ Correcto." : `✗ Esperado: ${current.pinyin}`}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={advanceToHanzi}
                  className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm"
                >
                  Dibujar hanzi →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "hanzi" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-neutral-400">
            Dibuja los trazos sin ver el carácter.
          </p>
          <div className="flex items-center justify-center">
            <AudioPlayer src={cnUrl} label="▶ Repetir audio (⌥R)" playToken={playToken} />
          </div>
          <div className="flex justify-center">
            <HanziCanvas
              key={`${current.simplified}-${difficulty}`}
              character={current.simplified}
              difficulty={difficulty}
              onComplete={(allCorrect) => {
                setHanziOk(allCorrect);
              }}
            />
          </div>
          {hanziOk !== null && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={advanceToReveal}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white"
              >
                Revelar →
              </button>
            </div>
          )}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setHanziOk(false);
                advanceToReveal();
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300"
              title="⌥S"
            >
              No sé — saltar al reveal (⌥S)
            </button>
          </div>
        </div>
      )}

      {phase === "reveal" && (
        <RevealPanel
          simplified={current.simplified}
          pinyin={current.pinyin}
          translationEs={current.translation_es}
          exampleZh={current.example_zh}
          exampleEs={current.example_es}
          sentAudioCn={sentCnUrl}
          sentAudioEs={sentEsUrl}
          showSentencePinyin={showSentencePinyin}
          onSelfGrade={(grade) =>
            goNext(pinyinOk === true, hanziOk === true, pinyinOk === null && hanziOk === null, grade)
          }
        />
      )}
      </div>
    </div>
  );
}
