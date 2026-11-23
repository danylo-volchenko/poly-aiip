# Lab spec — AIIP, Lab 1 (Part 1: Interface)

## Identity
- Course: «Опрацювання зображень методами штучного інтелекту», НУ «Львівська Політехніка», ІКНІ, кафедра ПЗ, гр. ПЗІП-11.
- Lab: №1, Частина 1 — Інтерфейс.
- Variant: 6 → THREE classes: Normal sinus rhythm, Tachycardia, Bradycardia.
- Report language: Ukrainian. Author: Волченко Д.О., гр. ПЗІП-11. Reviewer: асистент кафедри ПЗ Романяк О. І.
- Repo: /home/wired/dev/poly/aiip (remote `git@github.com:danylo-volchenko/poly-aiip.git`).

## Assignment
- Build an OFFLINE single-page web app (HTML5/CSS3/vanilla JS — no server, no build step, no frameworks) that classifies heart rhythm from a BPM (or RR, ms) sequence.
- Deliverables: working app under `src/` openable via `file://` (`src/index.html`), README, `start.sh`, example data.
- Required features (methodical + lecturer clarifications):
  1. Three recognition classes with configurable BPM ranges.
  2. Dataset generator: count, sequence length K, tolerance, test split, seed.
  3. Real progress indicators (not fake).
  4. Trainable model: configurable epochs and error threshold; learning rate / momentum / hidden neurons present in the UI but DISABLED until Brain.js (lab 2).
  5. Guard/warning against too-small datasets.
  6. Activity log panel with save and clear.
  7. Save results as images (PNG/JPG/BMP) and as text.
  8. Named (id'd) interface controls.
  9. Placeholders for not-yet-available data.
  10. Info (ⓘ) button explaining current state.
- Engine: threshold-sweep heuristic now; Brain.js 2.0.0-beta.24 integrated in lab 2 behind the SAME `model.js` interface.

## Code
- Entry: `src/index.html`. Run: open via `file://` or `./start.sh`. Test: `node test/run.js`. Syntax: `node --check <file>`.
- Namespace `window.AIIP`. Script load order: util, rng, logger, generator, model, charts, ecg-render, image-export, data-step, train-step, recognize-step, app.
- Modules: util (clamp/mean/sd/toRR/toBpm/nextFrame…), rng (seeded Random), logger, generator (CLASSES + formula-4 dataset), model (threshold engine; `train/evaluate/predictWindow/predictSeries/toJSON/fromJSON` — FROZEN for lab 2), charts, ecg-render, image-export, three `*-step` controllers, app.
- CLASSES (BPM ascending): Bradycardia 40–60 (`#009e73`), Normal 60–100 (`#0072b2`), Tachycardia 100–140 (`#e69f00`). Okabe–Ito palette.
- Frozen DOM ids: full contract in `.superpowers/sdd/lab1-compliance/progress.md`.
- Conventions: Linux-kernel-ish JS style (tabs, brace on own line), UI text English, comments minimal. Offline/`file://` only.
- Workflow steps (UI order): 1 Generate dataset → 2 Train model → 3 Recognize rhythm; plus header status bar and a sticky log panel.

## Report
- Format: ODT.
- Inputs: reference `Звіт_Франчук_ЛР1_Частина1_Інтерфейс.pdf` (variant 7, structure to mirror), methodical `Предмет_Романа_Андрійовича_Мельника_Методичка_неофіційна_автор_Романяк.pdf`, article `Генерування ритмів..pdf`.
- Outline: title page; ЗМІСТ; 1. Тема; 2. Постановка завдання; 3. Мета роботи; 4. Загальний опис застосунку; 5. Інтерфейс застосунку та обґрунтування рішень (5.1–5.9); 6. Сценарії використання (Табл. 2, 3); 7. Опис елементів інтерфейсу (Рис. 5–8, Табл. 4–7); 8. Зміни інтерфейсу (Табл. 8); 9. Можливі покращення; 10. Висновок.
- Captions: figure `Рисунок N - <text>` BELOW the figure (centered); table `Таблиця N - <text>` ABOVE the table. Subsection numbers carry a trailing dot (`5.8.`).
- Page: A4, margins 2 cm, Times New Roman 12 pt justified, line-height 150%.
- Generator: `.opencode/lab/report/gen.py` (+ `template/`). `python3 gen.py` → `report.odt`. TOC is static; rebuild after recomputing page numbers (see `lab-run` skill).
- Screenshots: user supplies. Leave `draw:frame` placeholders labelled `[МІСЦЕ ДЛЯ СКРІНШОТА]` with numbered captions. 14 figure slots, 8 tables.
- Delivered: `/home/wired/Documents/poly/AIIP-LAB1_Volchenko_PZIP-11_звіт.odt` (21 pages). Template (untouched): `/home/wired/Documents/poly/AIIP-LAB1_Volchenko_PZIP-11.odt`.

## Open questions
- Lab 2 = Brain.js integration (enable LR/momentum/hidden; keep `model.js` API frozen).
- User has not yet inserted the 14 screenshots.
