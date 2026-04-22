# hanziflow-quiz

Módulo de diagnóstico, repetición espaciada (SRS) y exámenes para el ecosistema HanziFlow. Diseñado como herramienta de estudio personal para el sprint HSK de Hiram — consulta directamente la base de datos HSK verificada del pipeline ETL y mantiene su propio registro de progreso.

## Objetivo

Reemplazar el diagnóstico manual en `.md` (~1,300 ítems marcados a mano) con una interfaz interactiva de flashcards que:

1. **Diagnostica** el nivel actual del usuario por bloques HSK (primera pasada rápida)
2. **Practica** con repetición espaciada diaria (SM-2 adaptado a 3 grados)
3. **Examina** con snapshots puntuales que quedan como referencia de avance

El sistema de 3 grados (☑ conozco / ◐ parcial / ☐ no sé) refleja la realidad del aprendizaje de hanzi: reconocer un carácter no es binario — existe el estado intermedio de "lo reconozco con pinyin pero no en hanzi solo".

## Stack

| Componente | Tecnología | Notas |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Puerto 3001 para no colisionar con writer (3000) |
| Lenguaje | TypeScript 6 | Strict mode |
| Estilos | Tailwind CSS 4 | Dark theme, CSS custom properties, card flip 3D |
| Base de datos (fuente) | SQLite vía better-sqlite3 | Read-only contra `hsk_vocabulary.db` del pipeline ETL |
| Base de datos (progreso) | SQLite vía better-sqlite3 | Read-write en `data/quiz_progress.db`, auto-creada |
| Algoritmo SRS | SM-2 (Woźniak) simplificado | 3 grados → mapped a grades 5/3/1 del SM-2 original |

## Arquitectura

```
hanziflow-quiz/
├── app/
│   ├── api/
│   │   ├── cards/route.ts      ← GET: tarjetas HSK por bloque
│   │   ├── progress/route.ts   ← POST: registrar review + SRS | GET: cola de pendientes
│   │   ├── stats/route.ts      ← GET: dashboard (vistas, racha, pendientes, historial)
│   │   └── exam/route.ts       ← POST: guardar snapshot | GET: listar exámenes
│   ├── diagnostic/page.tsx     ← Modo diagnóstico (selección de bloque → pasada secuencial)
│   ├── practice/page.tsx       ← Modo SRS (cola diaria de tarjetas pendientes)
│   ├── exam/page.tsx           ← Modo examen (multi-bloque, shuffled, snapshot guardado)
│   ├── page.tsx                ← Dashboard / home
│   ├── layout.tsx              ← Root layout (español, dark theme)
│   └── globals.css             ← Variables CSS, card flip animation
├── components/
│   └── flashcard.tsx           ← Componente principal: flip 3D, botones ☑/◐/☐, atajos teclado
├── lib/
│   ├── db.ts                   ← Capa de datos: conexión dual (HSK read-only + quiz read-write)
│   ├── srs.ts                  ← Motor SM-2 adaptado (calculateNextReview)
│   └── utils.ts                ← cn(), parseMeanings(), parsePos(), blockLabel()
└── data/
    └── quiz_progress.db        ← Auto-generada al primer uso (SQLite WAL mode)
```

### Dependencia externa crítica

La base HSK se lee de:
```
../HSK-word-list/hanzi-flow-hsk/output/hsk_vocabulary.db
```

Este path es relativo al `cwd()` del proceso. La DB debe existir antes de arrancar — se genera con el pipeline ETL de `hanzi-flow-hsk/`. Contiene 11,545 entradas de vocabulario y 16,600 asignaciones de nivel (HSK 2.0 + 3.0).

### Esquema de la DB fuente (read-only)

Las queries usan dos tablas del pipeline:

- **`vocabulary`** — una fila por ítem: `simplified`, `traditional`, `pinyin`, `pinyin_numeric`, `pos` (JSON array), `meanings_en` (JSON array), `frequency_rank`, `radical`
- **`vocabulary_levels`** — relación N:M: `simplified`, `hsk_version` ('2.0'|'3.0'), `level` (1-7), `order_in_level`

Se joinean por `simplified` con GROUP BY para evitar duplicados cuando un carácter aparece en múltiples niveles 3.0.

### Esquema de la DB de progreso (read-write)

```sql
-- Estado SRS por tarjeta
card_progress (simplified UNIQUE, ease_factor, interval_days, repetitions, next_review, last_dx)

-- Log de cada interacción individual
review_log (simplified, mode, result, response_ms, created_at)

-- Snapshots de exámenes
exam_snapshots (name, scope, total_cards, known, partial, unknown, score_pct, created_at)
```

### Bloques de tarjetas

| Block ID | Descripción | Count | Query |
|---|---|---|---|
| `hsk2_l1` | HSK 2.0 Nivel 1 | 156 | `vocabulary_levels WHERE hsk_version='2.0' AND level=1` |
| `hsk2_l2` | HSK 2.0 Nivel 2 | 163 | `vocabulary_levels WHERE hsk_version='2.0' AND level=2` |
| `hsk3_l1_new` | HSK 3.0 L1 (nuevos, no en 2.0) | 290 | `hsk_version='3.0' AND level=1` minus HSK 2.0 L1+L2 |
| `hsk3_l2_new` | HSK 3.0 L2 (nuevos, no en 2.0) | 703 | `hsk_version='3.0' AND level=2` minus HSK 2.0 L1+L2 |
| _(sin bloque)_ | Todos los anteriores deduplicados | 1,302 | Unión con dedup por `simplified` |

### Algoritmo SRS

SM-2 adaptado a 3 grados:

| Resultado | Efecto en ease | Efecto en intervalo | Efecto en repeticiones |
|---|---|---|---|
| ☑ known | +0.1 | 1d → 3d → interval × ease | +1 |
| ◐ partial | −0.15 | max(1, interval × 0.8) | mantiene (min 1) |
| ☐ unknown | −0.2 | reset a 0 (review hoy) | reset a 0 |

Ease mínimo: 1.3. Ease default: 2.5.

### API endpoints

```
GET  /api/cards?block={block_id}     → { cards: CardData[], count: number }
POST /api/progress                    → { status, next: SrsState }
     body: { simplified, result, mode, response_ms }
GET  /api/progress?limit=50           → { due: DueCard[], count: number }
GET  /api/stats                       → { total_cards_seen, by_dx, due_today, reviews_today, streak, exams }
POST /api/exam                        → { id, score_pct, status }
     body: { name, scope, total_cards, known, partial, unknown }
GET  /api/exam                        → { exams: ExamSnapshot[] }
```

### Atajos de teclado (flashcard)

| Tecla | Acción |
|---|---|
| Espacio / Enter | Voltear tarjeta |
| 1 / J | ☑ Conozco |
| 2 / K | ◐ Parcial |
| 3 / L | ☐ No sé |

## Comandos

```bash
npm install          # Instalar dependencias
npm run dev          # Dev server en localhost:3001
npm run build        # Build de producción
npm run start        # Servidor de producción en localhost:3001
npm run lint         # ESLint
```

Variable de entorno opcional: `QUIZ_DB_PATH` para sobreescribir la ubicación de la DB de progreso (default: `data/quiz_progress.db`).

## Modo Dictado (audio → escribe)

Modo productivo para practicar audio→pinyin→hanzi en bloques de 25–40 palabras.

```bash
npm run dev -- --hostname 0.0.0.0   # accesible en LAN
# Mac:    http://localhost:3001/dictado
# iPad:   http://<ip-del-mac>:3001/dictado   (Apple Pencil en Safari iOS)
```

Scopes soportados en MVP: `hsk2.0_l1` (156), `hsk2.0_l2` (163), `hsk3.0_l1` (507). Audio, oraciones y traducciones ES vienen de [`../hanziflow-audio/`](../hanziflow-audio/). Si ese directorio no existe en el host, el endpoint `/api/dictado/scope/*` seguirá devolviendo entradas sin ejemplos y los MP3 responderán 404.

Query params del bloque: `?size=30` (20–40 recomendado), `?voice=corta|larga|neutral` (default `larga`).

Los intentos se persisten en la tabla `dictado_attempts` dentro de `data/quiz_progress.db` (el MVP guarda pero no re-selecciona adaptativamente).

## Estado actual (v0.1 — prototipo funcional)

- [x] Lectura de tarjetas HSK desde DB verificada (4 bloques + all)
- [x] Componente flashcard con flip 3D y atajos de teclado
- [x] Modo diagnóstico (pasada secuencial por bloque)
- [x] Modo práctica SRS (cola diaria basada en SM-2)
- [x] Modo examen (multi-bloque, shuffle, snapshot)
- [x] Dashboard con estadísticas (vistas, racha, pendientes, historial)
- [x] API routes completas y testeadas
- [x] TypeScript strict sin errores

## Evolución como módulo independiente

### Fase 1 — Pulido de UX (inmediato)

- **Swipe gestures** en mobile (izquierda=no sé, arriba=parcial, derecha=conozco) para poder diagnosticar desde el teléfono sin teclado
- **Audio TTS** del pinyin al voltear la tarjeta (Web Speech API o audio files)
- **Filtro por diagnóstico previo**: en práctica, poder filtrar solo ☐/◐ para sesiones enfocadas
- **Undo**: botón para deshacer el último resultado (error de dedo frecuente en sesiones rápidas)
- **Session timer** visible: cuántos minutos llevas, tarjetas por minuto

### Fase 2 — Datos y análisis

- **Heatmap de actividad** (estilo GitHub contributions) con los datos de `review_log`
- **Curvas de retención** por bloque: gráfica de score % en exámenes a lo largo del tiempo
- **Distribución de ease factors**: detectar tarjetas "leeches" (ease < 1.5 después de 5+ reviews)
- **Export CSV** del progreso para análisis externo o backup
- **Importar diagnóstico .md**: parsear el archivo `02_alcance_HSK2_diagnostico.md` para pre-poblar `card_progress` con los dx ya marcados a mano

### Fase 3 — Funcionalidad avanzada

- **Reverse mode**: mostrar significado/pinyin → escribir/seleccionar hanzi (producción vs reconocimiento)
- **Sentence cards**: además del carácter aislado, mostrar la oración ejemplo de la DB (campo `example_sentences` — actualmente vacío, pendiente de poblar desde el corpus)
- **Leitner boxes** como alternativa visual al SM-2 para usuarios que prefieran ese modelo mental
- **Tags/categorías**: agrupar tarjetas por campo semántico (colores, familia, tiempo, etc.) cruzando con `semantic_group` de la DB
- **Spaced writing**: integrar con Hanzi Writer para práctica de trazos en las tarjetas marcadas como ◐ (conocimiento parcial)

### Fase 4 — Multi-usuario y persistencia remota

- **Auth básico** (usuario/contraseña o passkey) para uso en LAN compartida
- **Migrar quiz_progress.db a hanziflow-server** (FastAPI + SQLite centralizado en puerto 8000)
- **Sync offline**: Service Worker + IndexedDB para estudiar sin conexión, sync al reconectar
- **PWA manifest** para instalar como app nativa en móvil

## Unificación con hanziflow-writer

El objetivo final es un solo frontend HanziFlow con todas las herramientas de estudio. La unificación tiene sentido cuando ambos módulos estén estabilizados individualmente.

### Estado actual de cada módulo

| Aspecto | hanziflow-writer | hanziflow-quiz |
|---|---|---|
| Puerto | 3000 | 3001 |
| Backend | hanziflow-server (FastAPI :8000) | Propio (API routes + SQLite local) |
| DB de contenido | hanziflow-server SQLite + ATTACH hsk | HSK pipeline DB (read-only directo) |
| DB de progreso | hanziflow-server (vocab_progress) | quiz_progress.db local |
| Auth | Ninguna | Ninguna |
| UI framework | Next.js 16 + shadcn/ui | Next.js 16 + Tailwind raw |
| Funcionalidad | Writer (input + grid + stroke), HSK browser, Vaults, Sessions, Chat LLM | Flashcards (diagnóstico, SRS, examen) |

### Plan de unificación

**Paso 1 — Migrar quiz a hanziflow-server**
- Mover las tablas `card_progress`, `review_log`, `exam_snapshots` a la DB del server
- Crear router FastAPI `/api/quiz/*` equivalente a los 4 endpoints actuales
- Beneficio: una sola DB de progreso — `vocab_progress` (writer) y `card_progress` (quiz) se cruzan

**Paso 2 — Integrar quiz como rutas en writer**
- Copiar las pages de quiz (`/diagnostic`, `/practice`, `/exam`) al App Router de writer
- Adaptar componentes a shadcn/ui (los botones y cards de quiz → componentes de writer)
- Unificar `lib/utils.ts` (quiz tiene parseMeanings/parsePos que writer no necesita aún)
- Añadir links en el sidebar de writer: sección "Estudio" con diagnóstico/práctica/examen

**Paso 3 — Cruzar datos**
- El HSK browser de writer muestra el dx de cada palabra (☑/◐/☐ del diagnóstico)
- El writer puede sugerir "escribir" las tarjetas marcadas como ◐ (práctica de trazos targeted)
- Las vaults pueden generar sesiones de quiz automáticas (vault → deck de flashcards)
- El dashboard unificado muestra: sesiones de escritura + reviews SRS + exámenes en una timeline

**Paso 4 — Un solo proceso**
- Eliminar hanziflow-quiz como proyecto separado
- Todo corre en `localhost:3000` con hanziflow-server en `:8000`
- La DB HSK se sigue accediendo vía ATTACH en el server, no directo desde Next.js

### Dependencias que se eliminan en la unificación

- `better-sqlite3` sale del frontend (toda la DB pasa al server)
- Las API routes de Next.js se reemplazan por llamadas a FastAPI (ya existe `lib/api.ts` en writer)
- `data/quiz_progress.db` desaparece como archivo separado

### Lo que NO cambia

- El algoritmo SM-2 (`lib/srs.ts`) se mueve al server (Python) pero la lógica es idéntica
- El componente flashcard se mantiene casi igual — solo cambia de Tailwind raw a shadcn/ui wrappers
- Los 4 bloques HSK y sus queries son los mismos
- El sistema de 3 grados (☑/◐/☐) es compartido entre quiz y el `vocab_progress` de writer
