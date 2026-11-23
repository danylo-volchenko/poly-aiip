# AIIP - Labs 1-3: Rhythm Interface + Brain.js engine + benchmarks (variant 6)

Single-page application for generating, training on, and recognizing
heart-rhythm sequences: normal sinus rhythm, tachycardia, bradycardia.
Lab 3 adds performance benchmarks for inference, evaluation and training.

## Launch

No server, no build, no dependencies. Open `src/index.html` in a browser (sh: `xdg-open src/index.html`).

## Structure

```
src/index.html          app page
src/css/style.css       styles
src/lib/brain.js        vendored Brain.js 2.0.0-beta.24 (UMD browser build, MIT)
src/lib/brain-src.js    same source as a string, for the Blob-URL training Worker
src/js/util.js          helpers
src/js/rng.js           seeded random
src/js/logger.js        operations log
src/js/generator.js     dataset generation, CSV/JSON
src/js/model.js         rhythm model (Brain.js neural network)
src/js/train-worker.js  worker that trains the network off the main thread
src/js/charts.js        error/accuracy/scatter/gallery/benchmark charts
src/js/bench.js         benchmark core (series/dataset/stats/scenarios/runner)
src/js/bench-step.js    step 4 benchmark panel wiring
src/js/ecg-render.js   ECG strip + RR histogram composite
src/js/image-export.js  PNG/JPG/BMP saves
src/js/data-step.js     step 1 wiring
src/js/train-step.js    step 2 wiring
src/js/recognize-step.js step 3 wiring
src/js/app.js           bootstrap, status, modals
bench/run.js            headless benchmark runner (Node)
data/                   example CSV files for recognition
test/                   node test harness
```

## Workflow

1. Generate a dataset (step 1), or load one from CSV/JSON.
2. Train the model (step 2). The engine is a Brain.js feed-forward
   network (K inputs, one hidden layer of `hidden` neurons, 3 outputs)
   trained in a Web Worker. Learning rate, momentum and hidden neurons
   are configurable. If the browser cannot start the Worker (for example
   a `file://` restriction), training silently falls back to the main
   thread in short chunks so the UI stays responsive.
3. Enter, load, or pick an example sequence and recognize it
   (step 3). Save the result image (PNG/JPG/BMP) or text report.
4. Run benchmarks (step 4) after a model exists: choose sequence
   lengths, dataset sizes, window K, training epochs and repeats, then
   inspect the table and chart. Save the raw data as CSV or JSON.

## Benchmarks (Lab 3)

Step 4 measures the same code paths on six scenarios: inference vs
sequence length, evaluation vs dataset size, training vs dataset size,
window size K, training epochs, and Worker vs main thread (browser only).
Each case does one discarded warm-up run followed by the configured
number of timed runs; results report min, max, mean and median in ms.

The browser panel is a demo. Canonical numbers for the report come from
the headless Node runner, which uses the same benchmark core:

```
node bench/run.js                 # 5 runs per case, writes bench/results.json + .csv
node bench/run.js --quick         # reduced sizes for a smoke run
node bench/run.js --out /tmp/b.json --repeats 3
```

Flags: `--quick` (reduced sizes), `--out FILE` (JSON path; CSV uses the
same name with `.csv`), `--repeats N` (1-20 timed runs per case). The
runner prints a per-case min/mean/median summary and exits non-zero on
failure. The JSON schema is
`{meta:{startedAt,env,config,notes},cases:[{id,title,param,unit,params,runs,min,max,mean,median,notes}]}`;
`cases[].runs` holds every timed run in ms.

`model.js` exposes `train`, `evaluate`, `predictSeries`, `predictWindow`,
`toJSON`, `fromJSON`; the engine swap kept that interface frozen, so the
rest of the app does not depend on the classifier internals.
