# Lab spec — AIIP, Lab 3 (Part 3: Тестування та бенчмарки)

## Identity
- Course: «Опрацювання зображень методами штучного інтелекту» (AIIP), НУ «Львівська Політехніка», ІКНІ, кафедра ПЗ, гр. ПЗІП-11.
- Lab: №3 — «Частина 3. Тестування та бенчмарки».
- Report title: «Розпізнавання серцевих ритмів за допомогою нейронної мережі. Частина 3. Тестування та бенчмарки.»
- Variant: 6 — three classes (Bradycardia 40–60, Normal 60–100, Tachycardia 100–140), Brain.js feed-forward network over K=4 BPM values.
- Report language: Ukrainian. Author: Волченко Д.О., гр. ПЗІП-11. Reviewer: асистент кафедри ПЗ Романяк О. І.
- Repo: `/home/wired/dev/poly/aiip`.
- Baseline: labs 1–2 complete; `node test/run.js` green (47+), lab-2 Brain.js engine and Web Worker training in place.

## Assignment (methodology, Lab 3)
Goal: investigate performance of the implemented application, measure execution time of the main algorithm for different input volumes, analyse results, propose optimisations.
Required sections:
1. Benchmark conditions (OS, CPU, RAM, browser/version, Node version, libraries).
2. Test data preparation (several input sizes; for images: resolution, pixel count, file size, format, channels).
3. Measurement methodology (measured fragment, tool, start/end boundaries, what is included).
4. Repeatability — at least 5 runs per case; report min, max, mean/median; note warm-up/JIT effects.
5. Benchmark parameters and why they affect runtime.
6. Results table (all runs + averages, same units).
7. Visualisation — at least one chart (input volume → time), identify linear/non-linear behaviour.
8. Analysis — scaling, dominant parameter, anomalies and their causes, main bottleneck; compare with Lab-2 complexity analysis.
9. Possible improvements — concrete places/operations, memory copies, algorithm passes, parallel execution, Web Workers, optimised libraries, GPU.
10. Conclusion — scaling, key numbers, dominant parameter, bottleneck, expectation match, highest-impact optimisations.

Methodology goal text mentions measuring images up to 500 KB / 1 MB / 5 MB / 10 MB. Variant 6 processes BPM sequences, not images: the report must explicitly state this adaptation and benchmark the analogue of input volume — sequence length (inference) and dataset size (training).

## Scope (confirmed with user)
- Add a **Step 4 — Benchmark** panel to the app AND a headless **Node runner**.
  - In-app panel: parameters, progress, results table, chart, CSV/JSON export.
  - Node runner: canonical numbers for the report, reproducible 5-run protocol.
- Input-size mapping: sequence length + dataset size (not synthetic file sizes).
- Report: new ODT + PDF at `/home/wired/Documents/poly/AIIP-LAB3_Volchenko_PZIP-11_звіт.odt|pdf`.

## Frozen interfaces
Do NOT change:
- `RhythmModel` public API (`predictWindow`, `predictSeries`, `train`, `evaluate`, `toJSON`, `fromJSON`, `encodingFor`).
- `AIIP.data.generateDataset/splitSamples` signatures and sample shape `{label, bpm:number[]}`.
- Existing DOM ids and the 3-step workflow behaviour.
- Offline `file://`, no build step, no CDN.

New interfaces:
- `window.AIIP.bench` (new `src/js/bench.js`):
  - `series(n, seed)` → deterministic BPM array of length `n`, mixed classes.
  - `dataset(samples, seed, k)` → `{train, test, all}` from the existing generator.
  - `stats(runs)` → `{runs, min, max, mean, median}` (ms, 3 decimals).
  - `SCENARIOS` → ordered scenario descriptors.
  - `run(opts, hooks)` → async, `hooks.onCase`, `hooks.onProgress`, `hooks.shouldStop`; returns result object.
  - `toCsv(result)` / result JSON schema:
    `{ meta:{startedAt,env,config}, cases:[{id,title,param,unit,params,runs,min,max,mean,median,notes}] }`.
- New DOM ids: `bench-card`, `bench-form`, `bench-series-lengths`, `bench-dataset-sizes`, `bench-k`, `bench-epochs`, `bench-repeats`, `bench-run`, `bench-stop`, `bench-progress-wrap`, `bench-progress`, `bench-progress-text`, `bench-errors`, `bench-table`, `bench-chart`, `bench-save-csv`, `bench-save-json`, `bench-hint`, `status-bench`.
- Script order: `... model.js, charts.js, bench.js, bench-step.js, app.js`. `bench.js` must load in Node (`test/run.js` shim) without DOM/Worker.

## Scenarios (pilot-calibrated sizes allowed; keep each full run under ~10 min)
1. **Inference vs sequence length** — `predictSeries` on N = 1 000 / 5 000 / 25 000 / 125 000 / 500 000 BPM values, K=4, trained model, 5 runs each, warm-up run discarded. Expected O(N·K).
2. **Evaluation vs dataset size** — `evaluate` on S = 1 000 / 5 000 / 20 000 / 50 000 labelled samples (K=4), 5 runs.
3. **Training vs dataset size** — fresh model, S = 1 000 / 5 000 / 20 000 / 50 000 samples, epochs=20, hidden=8, lr=0.3, momentum=0.1, K=4; 5 runs. Node uses main-thread chunked path; browser uses Worker (record `trainPath`).
4. **Window size K** — K = 4 / 8 / 16 / 32 / 64; fixed N = 50 000; train a small model per K (epochs=10, 1 000 samples) then time `predictSeries`; 5 runs.
5. **Training epochs** — epochs = 10 / 25 / 50 / 100; S = 5 000, 5 runs; expected linear.
6. **Worker vs main thread (browser only, optional)** — same training config on Worker and on forced main-thread fallback (temporarily unset `AIIP.trainWorkerMain`); wall time + responsiveness notes. Do not modify `model.js`.

Deterministic seeds, fixed model hyper-parameters, GC/JIT notes, same machine. Time with `performance.now()` (browser) / `performance.now()` or `process.hrtime.bigint()` (Node); report both. Timed region excludes dataset generation, model construction and chart rendering unless stated.

## Code plan
1. `src/js/bench.js` — pure benchmark core: deterministic series/dataset builders, timing, stats, scenarios, async runner, CSV/JSON serialisers. Dependency: `AIIP.util`, `AIIP.data`, `AIIP.RhythmModel`.
2. `bench/run.js` — Node CLI: reuse the `test/run.js` vm loader for `lib/brain.js` + modules; flags `--quick`, `--out`, `--repeats`; writes `bench/results.json`, `bench/results.csv`, prints a compact table.
3. `src/js/bench-step.js` — Step 4 controller: validate inputs, run scenarios, live progress, render results table, chart, log lines, enable exports.
4. `src/index.html` — header «Lab 3»; 4th stepper item; Step 4 card (parameters, progress, table, chart placeholder, export buttons, hint); Help/Info text for benchmarks; script tags.
5. `src/css/style.css` — bench grid/table/chart sizing consistent with existing cards.
6. `src/js/charts.js` — `drawBench(canvas, result)`: time vs parameter, one line per scenario, labelled axes, optional log-x; must handle empty state.
7. `src/js/app.js` — stepper support for 4th step, Info modal benchmark entry, status updates from bench-step; keep `?appsmoke=1`.
8. `README.md` — Lab 3 benchmark usage (`node bench/run.js`, Step 4).
9. Tests `test/bench-test.js` — stats, deterministic series/dataset, CSV/JSON schema, tiny async run; keep suite green.
10. No commits unless the user asks.

## Report plan (Ukrainian, ODT → PDF)
Generator `.opencode/lab/report/gen-lab3.py` reusing `gen.py`/template; `pages-lab3.json`; figures from `bench/results.json` via matplotlib (`bench/plot.py`) into `.opencode/lab/report/figures/`.
Outline:
1. Тема
2. Постановка завдання (repeat variant 6 + benchmark task)
3. Мета роботи
4. Умови проведення бенчмарку
5. Підготовка тестових даних (adaptation: sequences/datasets instead of images; sizes, seeds, generation)
6. Методика вимірювання (timed fragment, tools, boundaries, warm-up, 5 runs)
7. Параметри бенчмарку (N, S, K, epochs, hidden; expected complexity)
8. Результати (tables: env, inference, evaluation, training, K, epochs; min/max/mean/median)
9. Візуалізація результатів (≥2 figures: time vs N, time vs S/K/epochs; describe shape)
10. Аналіз результатів (linearity/slopes, dominant parameter, anomalies: JIT/GC/Worker startup, bottleneck `net.run` matrix ops and per-window JS overhead; compare with Lab-2 O(N·K), O(E·S·K·H))
11. Аналіз можливих покращень (concrete: batch inference/typed arrays, avoid per-window closures and re-encoding, Float32, reduce hidden layer, early stopping, Worker for recognition, WebGL/GPU, optimised BLAS-like libs, memory reuse; estimate effect)
12. Висновок
- Captions: `Рисунок N - …` below figures, `Таблиця N - …` above tables; TNR 12 pt, 150 %, A4, 2 cm margins.
- Screenshot placeholders: Step 4 panel, results table + chart, optional browser performance profile. 3–4 slots, user fills.
- Deliverable: `/home/wired/Documents/poly/AIIP-LAB3_Volchenko_PZIP-11_звіт.odt` + `.pdf`.

## Verification gates
- `node test/run.js` all green (existing + bench tests).
- `node --check` on every JS file.
- `node bench/run.js --quick` completes and writes valid JSON/CSV.
- Full `node bench/run.js` produces 5 runs per case, no NaN, plausible scaling.
- Chromium `src/index.html?appsmoke=1` → APP-SMOKE PASS; `?benchsmoke=1` tiny run passes.
- Report renders in LibreOffice, TOC page numbers stable, figures/tables numbered and referenced, no overflow, placeholders visible.

## Open questions / rulings
- No image inputs in variant 6 → benchmark sequence length and dataset size; state this explicitly in §2/§5 of the report.
- Canonical report numbers from Node runner; in-app panel is the demo and may show slightly different absolute times.
- Existing uncommitted `src/js/model.js` edit (3 removed comment lines) is kept; no commits.
