# Plan: Modo "audio→escribe" en hanziflow-quiz

Autor del plan: Claude (sesión Cowork con Hiram, 2026-04-21).
Ejecutor: Claude Code, corriendo localmente sobre `hanziflow-quiz/`.
Validador post-trabajo: Claude (Cowork), siguiendo el prompt al final del doc.

---

## 1. Objetivo

Construir un modo de estudio **productivo** (no de recognition) en `hanziflow-quiz` para que Hiram practique audio→escribe en bloques de 25-40 palabras, pensando en el HSK 2 (2026-05-16). El loop por ítem:

1. Reproducir audio CN de la palabra.
2. Hiram escribe el **pinyin** (letras + selector de tono explícito).
3. Hiram dibuja el **hanzi** en canvas (stroke-validated vía `hanzi-writer`).
4. Reveal: oración CN + ES (con audio), traducción ES de la palabra.
5. Self-grade.

El modo NO es un IME real: el selector de tonos fuerza compromiso tonal explícito, a propósito — criterio pedagógico ya discutido con Hiram (aprendiz de L2 que está consolidando tonos).

---

## 2. Contexto — qué existe ya

**hanziflow-quiz** (Next.js 16, puerto 3001, standalone):
- Lee HSK DB directo con `better-sqlite3` desde `../HSK-word-list/hanzi-flow-hsk/output/hsk_vocabulary.db`.
- SQLite propio para progreso en `data/quiz_progress.db`.
- Rutas actuales: `/diagnostic`, `/practice`, `/exam`, `/api/cards`, `/api/progress`, `/api/exam`, `/api/stats`.
- Componente existente: `components/flashcard.tsx` — flip-based recognition.
- NO usa hanziflow-server. NO usa `hanzi-writer` lib todavía.

**hanziflow-audio** (`../hanziflow-audio/`):
- Cache de MP3s individuales en `cache/<scope>/<voice>/<eid>_cn.mp3`, `<eid>_sent.mp3`, y `cache/<scope>/_es/<eid>_es.mp3`, `<eid>_sent_es.mp3`.
- `<eid>` = primeros 10 hex de `md5(simplified)`.
- Voces CN: `corta` (Yunyang), `larga` (Yunxi), `neutral` (Yunjian). Voz ES única.
- Scopes con audio+sentences listos: `hsk2.0_l1` (156), `hsk2.0_l2` (163), `hsk3.0_l1` (507).
- Sentences en `sentences/<scope>.md` con formato:
  ```
  ## 的 (de)
  ZH: 这是我的书。
  ES: Este es mi libro.
  ```
- Translations en `translations/<scope>.json` — dict `simplified → traducción_ES`.

**hanziflow-writer** (puerto 3000, app grande):
- Ya tiene `hanzi-writer@^3.7.3` integrada con modo quiz funcional en `components/hanzi-writer.tsx` (referencia, NO importar cross-project — copiar patrón).
- Esta es el área de migración "eventual" del módulo; por ahora lo construimos aislado en hanziflow-quiz.

---

## 3. Deliverable — qué construir

### Rutas nuevas en hanziflow-quiz

```
app/dictado/page.tsx              — selector de scope + bloque
app/dictado/[scope]/page.tsx      — lista de bloques disponibles (1-30, 31-60, ...)
app/dictado/[scope]/[block]/page.tsx — loop activo del bloque
```

### Componentes nuevos

```
components/dictado/audio-player.tsx    — botón play/replay, auto-play on mount
components/dictado/pinyin-input.tsx    — input letras + selector de tono
components/dictado/hanzi-canvas.tsx    — wrapper de hanzi-writer en modo quiz
components/dictado/reveal-panel.tsx    — respuesta correcta + oración + ES + audio oración
components/dictado/item-loop.tsx       — orquestador del ítem
```

### Lógica compartida

```
lib/pinyin-tones.ts     — aplicar marca tonal según reglas (spec sección 6)
lib/audio-urls.ts       — construir URL del MP3 por (scope, voice, eid, kind)
lib/entry-id.ts         — md5(simplified).slice(0,10) — mismo hash que edge_tts
```

### API routes nuevas

```
app/api/dictado/scope/[scope]/route.ts   — GET: lista entradas del scope con pinyin + ES + oración
app/api/dictado/audio/[...path]/route.ts — GET: stream MP3 del cache (lee del FS)
```

### Dependencia nueva

```
npm install hanzi-writer
```

---

## 4. Decisiones de arquitectura

1. **Standalone**: no integrar con hanziflow-server. hanziflow-quiz ya accede HSK DB directo; el audio cache también está accesible por filesystem relativo (`../hanziflow-audio/cache/...`). Mantener el mismo patrón.

2. **Audio serving**: API route `/api/dictado/audio/[...path]/route.ts` que recibe `scope/voice/filename.mp3`, valida que el path esté dentro de `../hanziflow-audio/cache/` (evitar path traversal con `path.resolve` + `startsWith` check), lee el file con `fs.createReadStream`, responde con `Content-Type: audio/mpeg`. NO copiar MP3s a `public/` — se quedan en hanziflow-audio como fuente única.

3. **Scopes soportados en MVP**: hardcoded `["hsk2.0_l1", "hsk2.0_l2", "hsk3.0_l1"]` (los únicos con audio + sentences listos). `hsk3.0_l2` queda pendiente hasta que tenga sentences.

4. **Orden de entradas dentro del scope**: `ORDER BY COALESCE(frequency_rank, 999999) ASC` (igual que hanziflow-audio/sources.py — mismo orden que el audio compilado, así las palabras del bloque 1 son las primeras 30 del MP3 v1/v2/v3 correspondiente).

5. **Bloques**: tamaño configurable con default 30, por querystring `?size=30`. Un scope de 507 entries genera bloques `1-30, 31-60, ..., 481-507`.

6. **Voz CN**: default `larga` (Yunxi, la que Hiram usa de punto de partida según `config.py` y la memoria `reference_hanziflow_audio`). Configurable con querystring `?voice=corta|larga|neutral`.

7. **Progreso**: extender `quiz_progress.db` con tabla nueva `dictado_attempts (id, scope, simplified, attempted_at, pinyin_ok, hanzi_ok, self_grade)`. MVP guarda pero no usa para re-selección adaptiva; eso viene después.

8. **UX Spanish**: consistente con el resto del proyecto. Labels, botones, mensajes en español. Códigos/rutas en inglés (`/dictado` como excepción porque encaja con el tono Spanish del proyecto).

9. **iPad via LAN**: nada específico de dispositivo. Next.js `npm run dev -- --hostname 0.0.0.0` ya hace el trick y Pointer Events funcionan nativo con Apple Pencil en Safari iOS. No hay que programar nada para esto, solo documentarlo.

---

## 5. Task breakdown para Claude Code

**Tarea 1 — dependencias y estructura**
- `npm install hanzi-writer`
- Crear directorios: `app/dictado/`, `components/dictado/`, `lib/`
- Stub `app/dictado/page.tsx` con "Hola dictado"

**Tarea 2 — data layer**
- `lib/entry-id.ts`: `export function entryId(simplified: string): string { return md5(simplified).slice(0, 10); }` (usar `crypto` built-in de Node)
- `lib/audio-urls.ts`: funciones `cnAudioUrl(scope, voice, eid)`, `sentAudioUrl(scope, voice, eid)`, `esAudioUrl(scope, eid)`, `sentEsAudioUrl(scope, eid)` — todas devuelven strings tipo `/api/dictado/audio/<scope>/<voice>/<eid>_cn.mp3`
- `app/api/dictado/scope/[scope]/route.ts`: GET handler que:
  - Lee HSK DB vía `lib/db.ts` existente
  - Une con `../hanziflow-audio/translations/<scope>.json` para ES palabra
  - Parsea `../hanziflow-audio/sentences/<scope>.md` para oración CN + ES (reutiliza la lógica regex de `hanziflow-audio/sources.py` líneas 118-151, adaptada a TS — es un one-liner de `readline`)
  - Devuelve array ordenado: `{ simplified, pinyin, meanings_en, translation_es, example_zh, example_es }[]`
- `app/api/dictado/audio/[...path]/route.ts`: GET handler que valida path y stream MP3
  - **Seguridad crítica**: `const audioRoot = path.resolve(process.cwd(), "../hanziflow-audio/cache"); const fullPath = path.resolve(audioRoot, ...params.path); if (!fullPath.startsWith(audioRoot + path.sep)) return 403;`

**Tarea 3 — pinyin tone logic**
- `lib/pinyin-tones.ts` con la spec completa de sección 6 de este doc. Incluir tests en el mismo file (o en `lib/__tests__/pinyin-tones.test.ts` si hay jest configurado — check).

**Tarea 4 — componentes**
- `audio-player.tsx`: recibe `src: string`, renderiza `<audio autoPlay>` + botón replay. Maneja autoplay policy de Safari (user-gesture-first): primer audio del bloque requiere click manual.
- `pinyin-input.tsx`: controla state `{ rawLetters: string, tone: 0|1|2|3|4 }`, muestra preview con `applyTone(rawLetters, tone)`, input `[a-zA-Zü]` + `v→ü` live. Normaliza a lowercase.
- `hanzi-canvas.tsx`: crea div, instancia `HanziWriter.create(div, targetChar, { ..., showCharacter: false })` y llama `writer.quiz({ onComplete })`. Tamaño responsive pero mínimo 240x240px. Pointer Events funcionan automático.
- `reveal-panel.tsx`: muestra respuesta correcta (pinyin, hanzi, ES palabra), luego oración ZH con play-button que reproduce `_sent.mp3` + línea ES con play-button de `_sent_es.mp3`.
- `item-loop.tsx`: state machine con fases `playing | pinyin | hanzi | reveal | done`, callbacks entre ellas. Botón "pasar / no sé" siempre disponible.

**Tarea 5 — páginas**
- `app/dictado/page.tsx`: landing. Tres cards (hsk2.0_l1, hsk2.0_l2, hsk3.0_l1) con conteo de entradas. Link a `/dictado/<scope>`.
- `app/dictado/[scope]/page.tsx`: fetch de `/api/dictado/scope/<scope>`, mostrar grid de bloques `1-30, 31-60, ...`. Link a `/dictado/<scope>/<block>?voice=larga&size=30`.
- `app/dictado/[scope]/[block]/page.tsx`: server-side fetch del scope, slice del bloque, pasa a `<ItemLoop />` client component. Al terminar bloque muestra summary `N/M pinyin · N/M hanzi · link a siguiente bloque`.

**Tarea 6 — progreso**
- Extender `lib/db.ts` con `getDictadoDb()` si hace falta, o reutilizar el quiz_progress existente
- Tabla `dictado_attempts`:
  ```sql
  CREATE TABLE IF NOT EXISTS dictado_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,
    simplified TEXT NOT NULL,
    attempted_at INTEGER NOT NULL,
    pinyin_ok INTEGER NOT NULL,
    hanzi_ok INTEGER NOT NULL,
    self_grade TEXT,
    pinyin_input TEXT,
    response_ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS ix_dictado_scope_simp ON dictado_attempts(scope, simplified);
  ```
- POST `/api/dictado/attempt` que inserta un row por item completado

**Tarea 7 — documentación**
- Actualizar `README.md` de hanziflow-quiz: nueva sección "Modo dictado" con `npm run dev`, URL `http://localhost:3001/dictado`, nota de iPad LAN (`next dev --hostname 0.0.0.0` + URL `http://<ip-del-mac>:3001/dictado` en Safari iOS)

---

## 6. Spec: algoritmo de marca tonal

### Reglas de posición
Dado un syllable `s` (letras minúsculas, ya con `v→ü`) y tono `t ∈ {0,1,2,3,4}`:

1. Si `t === 0`: devolver `s` tal cual (sin marca, tono neutro).
2. Encontrar índice de la vocal a marcar:
   - Si `s` contiene `'a'` → índice de `a`.
   - Else si `s` contiene `'o'` → índice de `o`.
   - Else si `s` contiene `'e'` → índice de `e`.
   - Else → índice de la ÚLTIMA vocal en `s` (cubre iu → u, ui → i).
3. Reemplazar esa vocal por su versión tónica según el tono.

### Tabla de vocales tónicas
```ts
const TONES: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};
```

### Casos de test (DEBEN pasar)
```ts
applyTone("ma", 1)  === "mā"
applyTone("ma", 0)  === "ma"
applyTone("hao", 3) === "hǎo"   // a gana sobre o
applyTone("dui", 4) === "duì"   // ui: última vocal (i)
applyTone("jiu", 3) === "jiǔ"   // iu: última vocal (u)
applyTone("nü", 3)  === "nǚ"    // ü directo
applyTone("lüe", 4) === "lüè"   // e gana sobre ü
applyTone("niu", 2) === "niú"   // iu: última vocal (u)
applyTone("gui", 4) === "guì"   // ui: última vocal (i)
applyTone("yue", 4) === "yuè"   // e gana sobre u
applyTone("e", 4)   === "è"
```

### Input live transform
- Usuario teclea: restringir a `[a-z]` y tratar `v` como `ü`. En render mostrar `ü` (no `v`) en el input value.
- No dejar teclear tonos diacríticos a mano — solo vía los 5 botones (1/2/3/4/neutral).
- Mostrar preview del resultado con marca tonal debajo del input en tiempo real.

### Comparación con respuesta correcta
- Normalizar la respuesta de la DB: quitar espacios internos, `lowercase`, NFC-normalize.
- Normalizar input del usuario igual.
- Comparar como strings exactos. Pinyin multi-syllable (ej. `tóng xué`): permitir o no space — spec: **permitir input sin spaces**, o sea, comparar `userInput.replace(/\s+/g,"")` vs `dbPinyin.replace(/\s+/g,"")`.

---

## 7. Consideraciones de audio autoplay

Safari desktop y Safari iOS bloquean autoplay hasta después del primer user gesture. Solución:
- Primer ítem del bloque: muestra un botón grande "▶ Empezar" que hace click para disparar el `audio.play()` inicial.
- Ítems subsiguientes: el click del botón "siguiente" cuenta como user gesture para el audio del ítem siguiente.
- Siempre tener botón replay disponible.

---

## 8. Out-of-scope (MVP explícitamente excluye)

- Selección adaptiva de ítems (SRS-like): solo orden secuencial por frequency_rank.
- Stats dashboard: guarda attempts pero no los muestra todavía.
- Migración a hanziflow-writer: queda para iteración post-MVP.
- Integración con hanziflow-server: standalone sigue.
- Cámara/OCR/iPad app nativa: queda para v2.
- Modo v3sub2-style sin ES: MVP siempre muestra reveal completo.

---

## 9. Acceptance criteria

El MVP se considera terminado cuando Hiram puede:

1. Abrir `http://localhost:3001/dictado` en su Mac.
2. Ver tres scopes (HSK 2.0 L1, HSK 2.0 L2, HSK 3.0 L1) con conteo de entradas correcto.
3. Entrar a un scope y ver bloques `1-30, 31-60, ...`.
4. Empezar un bloque, oír el audio de la primera palabra sin problemas.
5. Teclear pinyin letras + elegir tono, ver la marca tonal aplicada correctamente.
6. Validar pinyin (respuesta correcta acepta, incorrecta marca como fallo).
7. Dibujar el hanzi en el canvas con mouse o Apple Pencil (si está en iPad).
8. Ver la `hanzi-writer` quiz validar stroke por stroke.
9. Ver el reveal: ES palabra, oración CN con audio, oración ES con audio.
10. Avanzar al siguiente ítem sin fricción.
11. Terminar el bloque, ver summary `N/M · N/M`.
12. Los 11 casos de test de tonos de la sección 6 pasan (ej. vía tests o verificación manual en UI).
13. Abrir `http://<ip-del-mac>:3001/dictado` desde Safari del iPad y completar un ítem con Apple Pencil.

---

## 10. Validation prompt (para Claude Cowork post-trabajo de Claude Code)

> Claude Code terminó de implementar el módulo `/dictado` en `hanziflow-quiz` según `AUDIO_WRITE_PLAN.md`. Valida el trabajo sin re-implementar; estamos auditando lo que entregó.
>
> Checklist (marcar con ✓/✗ cada punto, resumen al final):
>
> **Estructura de archivos**
> - `[ ]` Existen `app/dictado/page.tsx`, `app/dictado/[scope]/page.tsx`, `app/dictado/[scope]/[block]/page.tsx`.
> - `[ ]` Existen los 5 componentes `components/dictado/*.tsx`.
> - `[ ]` Existen `lib/pinyin-tones.ts`, `lib/audio-urls.ts`, `lib/entry-id.ts`.
> - `[ ]` Existen `app/api/dictado/scope/[scope]/route.ts` y `app/api/dictado/audio/[...path]/route.ts`.
> - `[ ]` `package.json` incluye `hanzi-writer` como dep.
>
> **Seguridad del audio endpoint**
> - `[ ]` Leer `app/api/dictado/audio/[...path]/route.ts` y confirmar que hace `path.resolve` + check de prefijo contra `audioRoot` antes de servir. Un intento como `GET /api/dictado/audio/../../etc/passwd` DEBE devolver 403/404. Si no, es bug bloqueante.
>
> **Pinyin tones — correctness**
> - `[ ]` Leer `lib/pinyin-tones.ts`. Para cada uno de los 11 casos del plan (§6), confirmar que el código produce la salida esperada. Idealmente hay tests; si no, ejecutar mentalmente el algoritmo caso por caso.
> - `[ ]` El caso `v→ü` está manejado tanto en input-transform como en la tabla de vocales.
>
> **API route scope**
> - `[ ]` Arrancar `npm run dev` y hacer `curl http://localhost:3001/api/dictado/scope/hsk3.0_l1 | jq '. | length'`. Debe devolver 507.
> - `[ ]` El primer item del JSON debe tener `simplified`, `pinyin`, `translation_es`, `example_zh`, `example_es` todos populados.
>
> **API route audio**
> - `[ ]` `curl -I http://localhost:3001/api/dictado/audio/hsk3.0_l1/larga/<eid>_cn.mp3` donde `<eid>` es `md5("的").slice(0,10)` = `5ea5d1c3b5`. Debe devolver `200` + `Content-Type: audio/mpeg`.
> - `[ ]` `curl -I http://localhost:3001/api/dictado/audio/../../../etc/passwd` debe devolver 403/404.
>
> **UI smoke test (manual en navegador)**
> - `[ ]` `/dictado` muestra las 3 cards de scope con conteos correctos (156 / 163 / 507).
> - `[ ]` `/dictado/hsk3.0_l1` muestra 17 bloques (507/30 redondeado hacia arriba).
> - `[ ]` `/dictado/hsk3.0_l1/1` arranca el primer ítem con 的. Tras click en "empezar" el audio se reproduce.
> - `[ ]` Tecleo `de` + click tono 0 (neutral) → valida correcto.
> - `[ ]` Tecleo `dé` directo (sin selector): debe rechazarse como input o aceptarse solo si matchea.
> - `[ ]` Canvas de hanzi acepta trazos con mouse. Dibujar 的 correctamente completa el quiz.
> - `[ ]` Reveal panel muestra ES palabra + oración CN+ES + 2 play buttons funcionales.
>
> **Progreso**
> - `[ ]` Tras completar el ítem 1, `sqlite3 data/quiz_progress.db "SELECT * FROM dictado_attempts LIMIT 1"` devuelve una fila.
>
> **Reporte**
> Si cualquier bloque falla, describir el bug específico (file + línea si aplica) y qué comportamiento correcto se esperaba. Si todo pasa, un resumen de 3-5 líneas confirmando readiness para que Hiram pruebe desde el iPad en LAN.

---

## 11. Notas de futuro (no para este MVP)

- Bloques rolling con overlap de 10 palabras de bloques anteriores (interleaving).
- Metric dashboard: accuracy por ítem, tiempo de respuesta, curva de olvido.
- Migración a hanziflow-writer: reutilizar el `<ItemLoop />` como feature del writer principal, deprecar el de quiz.
- Modo "solo pinyin" para días de puro listening review (saltar hanzi canvas).
- Voz toggleable en runtime.
- TTS de rumbo inverso (texto ES → audio ES) para auto-práctica de la oración.
