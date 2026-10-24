# AIIP - Labs 1-2: Rhythm Interface + Brain.js engine (variant 6)

Single-page application for generating, training on, and recognizing
heart-rhythm sequences: normal sinus rhythm, tachycardia, bradycardia.

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
src/js/charts.js        error/accuracy/scatter/gallery charts
src/js/ecg-render.js   ECG strip + RR histogram composite
src/js/image-export.js  PNG/JPG/BMP saves
src/js/data-step.js     step 1 wiring
src/js/train-step.js    step 2 wiring
src/js/recognize-step.js step 3 wiring
src/js/app.js           bootstrap, status, modals
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

`model.js` exposes `train`, `evaluate`, `predictSeries`, `predictWindow`,
`toJSON`, `fromJSON`; the engine swap kept that interface frozen, so the
rest of the app does not depend on the classifier internals.
