# Lab spec — AIIP, Lab 2 (Part 2: Алгоритм)

## Identity
- Course: «Опрацювання зображень методами штучного інтелекту» (AIIP)
- Variant: **6** — THREE classes: Bradycardia 40–60 (#009e73) / Normal 60–100 (#0072b2) / Tachycardia 100–140 (#e69f00) (Okabe–Ito)
- Report title: «Розпізнавання серцевих ритмів за допомогою нейронної мережі. Частина 2. Алгоритм.»
- Report language: Ukrainian. Deliver a NEW ODT (path confirmed with user).
- Deadline: 26 Oct 2026 (methodology).

## Assignment (variant 6, verbatim from methodology PDF)
«Згенерувати послідовності по 4 числа, що відображають: 1) ритми нормального серця, 2) серця швидкого (тахікардія) і 3) повільного (брадікардія). Ними навчити просту мережу і розпізнавати послідовності на вході. Кількість даних можна обмежити.»

## Goal
Replace the threshold-sweep heuristic engine in `src/js/model.js` with a real **Brain.js** feedforward neural network, behind the SAME frozen public API, and write the «Алгоритм» report per the methodology.

## Frozen public API of `RhythmModel` (must NOT change)
`predictWindow(bpm)`, `predictSeries(bpm)`, `async train(trainSet, testSet, opts, hooks)`, `async evaluate(samples, hooks)`, `toJSON()`, `static fromJSON(obj)`, `static encodingFor(samples)`.
Return shapes must stay identical (predictWindow → {probs,index,label,confidence}; predictSeries → {windows,probs,index,label,confidence,perWindow}; evaluate → {confusion,perClass,accuracy,macroF1,crossEntropy,misclassified}).

## Code changes (files + exact touchpoints)
1. **Vendor Brain.js locally** — offline `file://` app, NO CDN, no build step. Put browser build (global `brain.NeuralNetwork`) into `src/lib/` and `<script>` it BEFORE the app scripts in `src/index.html`. Use Brain.js 2.x (2.0.0-beta.24 if available). Also make it loadable in `test/run.js` (Node): either `require('brain.js')` if the harness supports node_modules, or load the same vendored UMD via a shim. Note current `test/run.js` passes 47/47 and loads the IIFE modules via a window/DOM shim — keep it green.
2. **`src/js/model.js`** — rewrite internals, keep class + API:
   - Drop threshold machinery: `TEMP/GRID/TIE/scoreByKey/classifyKey/linspace/accuracyWith/classMeans/initBoxes/shrinkBox/boundaries`.
   - Keep `softmax()`, `encode(v)` (0..1 via `this.encoding`), `now()`, `encodingFor()`.
   - Store `this.net` (brain.NeuralNetwork), `this.hidden`, `this.learningRate`, `this.momentum`, `this.encoding`, `this.k`, `this.history`, `this.trainSize/testSize/trainedAt/source`.
   - Build training data from `trainSet` samples `{label, bpm:[k values]}`: `{ input: bpm.map(v => this.encode(v)), output: oneHot(label) }` (one-hot over CLASSES keys).
   - `train(trainSet,testSet,opts,hooks)`: opts now `{epochs, errorThresh, learningRate, momentum, hidden}`. Build `brain.NeuralNetwork({ inputSize:k, hiddenLayers:[hidden], outputSize:3 })`. Training runs in a **Web Worker** (see Worker design below); `train()` posts the training data + config, relays worker progress to `hooks.onEpoch({epoch, epochs, error, trainAcc, testAcc})`, honours `hooks.shouldStop()` (post a stop message), and resolves with the final `history`. On worker completion, `this.net.fromJSON(netJSON)`. **Fallback:** if Worker construction fails (file:// blocked) or errors, fall back to chunked main-thread `net.train()` (iterations-per-call loop with `await u.nextFrame()` yields). Track `history` exactly: `epoch[]` (1..done), `error[]`, `evalEpoch[]` + `trainAcc[]` + `testAcc[]` every `evalEvery = max(1, round(epochs/100))`. Early-stop when `errorThresh>0 && error<=errorThresh`. Set `trainedAt`, return history.
   - `predictWindow(bpm)`: `net.run(bpm.map(encode))` → raw 3 outputs (object keyed by class) → array in CLASSES order → `softmax()` → probs/index/label/confidence.
   - `predictSeries`: unchanged logic (sliding window over `predictWindow`).
   - `evaluate`: unchanged (uses `predictSeries`), keep cross-entropy from probs.
   - `toJSON()`: `{format:"aiip-model", version:2, engine:"brain.js", k, hidden, learningRate, momentum, encoding, history, trainSize, testSize, trainedAt, net: this.net.toJSON()}`.
   - `fromJSON(obj)`: validate `format==="aiip-model"`, `version`, `k`, `encoding`; reconstruct `brain.NeuralNetwork().fromJSON(obj.net)`; set fields; `source="file"`. Keep backward error messages pattern.
3. **`src/js/train-step.js`**:
   - `validate()` (line ~45): add validation for learning-rate (>0, reasonable), momentum (0..1), hidden (positive int).
   - `startTraining` (line ~213): read `#train-learning-rate`, `#train-momentum`, `#train-hidden`; pass in opts (line 235).
   - `renderSummary` (line ~80): replace `engine "threshold"` + `boundaries` tiles with `engine "brain.js"`, `hidden neurons`, `learning rate`, `momentum`, keep K/epochs/train acc/test acc.
   - Status messages (lines ~276, ~346): `"brain.js · hidden N · <acc>%"` instead of `"threshold · low/high BPM …"`.
   - `loadModel` log (lines ~343): drop boundaries, log hidden/learningRate.
   - Model save filename (line ~379): `ecg_model_K<k>-nn_<timestamp>.json`.
4. **`src/js/recognize-step.js`**:
   - `buildResultText` (line ~177): `"model: brain.js, K=…, hidden …, encoding …"`.
   - line ~250: stop passing `boundaries` to ecg-render (see #5).
5. **`src/js/ecg-render.js`** (line ~217): replace the `boundaries low/high BPM` footer string with `brain.js · hidden <N> · <encoding.min>–<encoding.max> BPM` (or equivalent). Adjust callers that pass `data.boundaries`.
6. **`src/js/app.js`**:
   - Info modal «Model» (lines ~94–98): engine `"brain.js"`, hidden neurons, learning rate, momentum, encoding.
   - Info modal «Environment» (lines ~148–149): `"model engine" → "brain.js <version>"`, replace `"not integrated yet"`.
   - line ~249: drop `boundaries` from ecg-render payload.
   - line ~332: log `"engine: brain.js (neural network) …"`.
7. **`src/index.html`**: un-disable `#train-learning-rate` (0.3), `#train-momentum` (0.1), `#train-hidden` (8); update their hint text (remove "active after Brain.js integration (lab 2)"); add Brain.js `<script>`; update Help modal limits/engine text.
8. **`README.md`**: update engine description (Brain.js now, not "threshold in lab 1").
9. **Tests**: extend `test/` to cover new engine — train→predict round-trip, evaluate metrics present, toJSON/fromJSON round-trip, encoding bounds. Keep `node test/run.js` all green.

## Report (methodology «Лабораторна 2 (Алгоритм)» structure)
Common: Тема (+«Частина 2. Алгоритм.»), Постановка завдання (repeat variant 6), Мета («застосувати та створити алгоритм розпізнавання серцевих ритмів за допомогою нейронної мережі»).
Sections:
1. Опис алгоритму — inputs, stages, transformations, result, parameters; add pseudocode and/or block-scheme (optional but recommended).
2. Основні функції реалізації — per main function: purpose / inputs / operations / result / role. **Include FULL SOURCE CODE** (methodology requires full code in the report — appendix listing of the key modules, esp. model.js).
3. Обґрунтування вибору алгоритму — why NN + ≥1 alternative (e.g. the prior threshold/sweep heuristic, or a rule-based classifier) + why not used.
4. Вибір технологій — JS, Brain.js, canvas, why; offline file:// rationale.
5. Недоліки та обмеження реалізації — limitations + proposed fixes.
6. Аналіз можливості паралельного виконання — parallel vs serial parts, benefit, cost.
7. Паралельність залежно від технології — Web Workers: problem, what could be offloaded, why used/not, responsiveness impact.
8. Практичний приклад паралельного виконання — code if used, else a small standalone Worker example + why not in final.
9. Висновок.

Format: reuse LAB1 report template/title-page (A4, TNR 12pt, justified 150%), title page «Звіт до лабораторної роботи №2», «на тему: … Частина 2. Алгоритм», ЗМІСТ with page numbers, figure captions «Рисунок N - …» BELOW figures, table captions «Таблиця N - …» ABOVE tables. Leave `[МІСЦЕ ДЛЯ СКРІНШОТА]` placeholder frames for the user's screenshots. Report generator: `.opencode/lab/report/gen.py` (extend for lab 2 body; reuse template/ styles).

## Web Worker design (confirmed: REAL worker)
- New file `src/js/train-worker.js`: receives `{type:"train", data, config, evalEvery, trainSize, testSize}`; builds + trains `brain.NeuralNetwork`; posts `{type:"progress", epoch, error, trainAcc, testAcc}` per iteration/eval, `{type:"done", netJSON, history}` on finish, `{type:"error", message}` on failure; listens for `{type:"stop"}` (sets flag, stops at next iteration). Worker needs `brain` global.
- **CRITICAL file:// constraint:** Chrome blocks `new Worker('file://...')` (origin 'null'). Offline app MUST construct the worker via a **Blob URL** (`new Worker(URL.createObjectURL(new Blob([src])))`) and the worker must get Brain.js WITHOUT `importScripts('file://...')` (also blocked). Recommended: embed Brain.js source into the blob by loading the vendored `brain.js` text once and concatenating, or ship a `lib/brain-src.js` that assigns the source string to a global. Verify in headless chromium (`src/index.html?appsmoke=1` must still APP-SMOKE PASS).
- Fallback (always present): if `window.Worker` unavailable or the blob/worker throws, model.js silently falls back to chunked main-thread training so the app keeps working. Report §7–8 describe both paths honestly.
- `test/run.js` (Node, no DOM Worker): the harness should exercise the chunked-fallback code path (or a pure `brain`-based train) so tests stay green; worker path is covered by the chromium appsmoke.

## Parallel-execution decision
CONFIRMED by user: implement real Web Worker for training (with main-thread chunked fallback). Report sections 6–8 present the Worker as the primary mechanism with real code fragments (worker file + message protocol) and explain the fallback + why full parallelism is used now.

## Verification gates
`node test/run.js` all green · `node --check` all js · `src/index.html?appsmoke=1` APP-SMOKE PASS (chromium) · report renders + TOC stable.
