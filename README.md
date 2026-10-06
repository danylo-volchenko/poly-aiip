# AIIP - Lab 1: Rhythm Interface (variant 6)

Single-page application for generating, training on, and recognizing
heart-rhythm sequences: normal sinus rhythm, tachycardia, bradycardia.

## Launch

No server, no build, no dependencies. Open `src/index.html` in a browser (sh: `xdg-open src/index.html`).

## Structure

```
src/index.html          app page
src/css/style.css       styles
src/js/util.js          helpers
src/js/rng.js           seeded random
src/js/logger.js        operations log
src/js/generator.js     dataset generation, CSV/JSON
src/js/model.js         rhythm model (threshold engine)
src/js/charts.js        error/accuracy/scatter/gallery charts
src/js/ecg-render.js   ECG strip + RR histogram composite
src/js/image-export.js  PNG/JPG/BMP saves
src/js/data-step.js     step 1 wiring
src/js/train-step.js    step 2 wiring
src/js/recognize-step.js step 3 wiring
src/js/app.js           bootstrap, status, modals
src/lib/                reserved (Brain.js, lab 2)
data/                   example CSV files for recognition
test/                   node test harness
```

## Workflow

1. Generate a dataset (step 1), or load one from CSV/JSON.
2. Train the model (step 2). Current engine fits BPM decision
   boundaries; Brain.js neural network arrives in lab 2 behind the
   same interface.
3. Enter, load, or pick an example sequence and recognize it
   (step 3). Save the result image (PNG/JPG/BMP) or text report.

The training engine is a module-level swap: `model.js` exposes
`train`, `evaluate`, `predictSeries`, `predictWindow`, `toJSON`,
`fromJSON`; lab 2 replaces its internals with Brain.js without
touching the rest of the app.
