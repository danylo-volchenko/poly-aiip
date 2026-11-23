(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const ROUND = 3;
	const TEST_PCT = 20;
	const TOL = 4;
	const DEFAULTS = {
		hidden: 8,
		learningRate: 0.3,
		momentum: 0.1,
	};
	const SIZES = {
		inference: [1000, 5000, 25000, 125000, 500000],
		evaluation: [1000, 5000, 20000, 50000],
		training: [1000, 5000, 20000, 50000],
		k: [4, 8, 16, 32, 64],
		epochs: [10, 25, 50, 100],
	};
	const QUICK_SIZES = {
		inference: [1000, 5000],
		evaluation: [1000, 5000],
		training: [1000],
		k: [4, 8],
		epochs: [10, 25],
	};
	const LIMITS = {
		series: { lo: 100, hi: 1000000 },
		dataset: { lo: 100, hi: 100000 },
		k: { lo: 2, hi: 64 },
		epochs: { lo: 1, hi: 500 },
		repeats: { lo: 1, hi: 20 },
	};
	const BASE_K = 4;
	const BASE_EPOCHS = 20;

	function sanitizeInt(value, label, lim, fallback, notes)
	{
		if (value === undefined || value === null)
			return fallback;
		const n = Number(value);
		if (!Number.isInteger(n) || n < lim.lo || n > lim.hi) {
			notes.push(label + " " + value + " ignored (outside " +
				lim.lo + ".." + lim.hi + "), using " + fallback);
			return fallback;
		}
		return n;
	}

	function sanitizeList(values, label, lim, fallback, notes)
	{
		if (values === undefined || values === null)
			return fallback.slice();
		if (!Array.isArray(values)) {
			notes.push(label + ": not a list, using defaults");
			return fallback.slice();
		}
		const out = [];
		const seen = new Set();
		for (const raw of values) {
			const n = Number(raw);
			if (!Number.isInteger(n) || n < lim.lo || n > lim.hi) {
				notes.push(label + " " + raw + " ignored (outside " +
					lim.lo + ".." + lim.hi + ")");
				continue;
			}
			if (seen.has(n))
				continue;
			seen.add(n);
			out.push(n);
		}
		if (!out.length) {
			notes.push(label + ": no valid values, using defaults");
			return fallback.slice();
		}
		return out;
	}

	const SCENARIOS = [
		{
			id: "inference",
			title: "Inference vs sequence length",
			param: "N",
			unit: "BPM values",
			sizes: SIZES.inference,
			note: "predictSeries on a trained model, K=4",
		},
		{
			id: "evaluation",
			title: "Evaluation vs dataset size",
			param: "S",
			unit: "samples",
			sizes: SIZES.evaluation,
			note: "evaluate on all labelled samples, K=4",
		},
		{
			id: "training",
			title: "Training vs dataset size",
			param: "S",
			unit: "samples",
			sizes: SIZES.training,
			note: "fresh model, 20 epochs, hidden 8, K=4",
		},
		{
			id: "window-k",
			title: "Window size K",
			param: "K",
			unit: "values",
			sizes: SIZES.k,
			note: "predictSeries on N=50000, model trained per K",
		},
		{
			id: "epochs",
			title: "Training epochs",
			param: "epochs",
			unit: "epochs",
			sizes: SIZES.epochs,
			note: "S=5000, fresh model per repeat, K=4",
		},
		{
			id: "worker-main",
			title: "Worker vs main thread",
			param: "path",
			unit: "ms",
			sizes: ["worker", "main-thread"],
			note: "browser only; S=5000, 20 epochs",
		},
	];

	function now()
	{
		return typeof performance !== "undefined" && performance.now
			? performance.now()
			: Date.now();
	}

	function round3(v)
	{
		return Math.round(v * 1000) / 1000;
	}

	function workerCtor()
	{
		if (typeof Worker === "function")
			return Worker;
		if (typeof window !== "undefined" && typeof window.Worker === "function")
			return window.Worker;
		return null;
	}

	function envInfo()
	{
		const proc = typeof process !== "undefined" && process.versions ? process.versions : null;
		const nav = typeof navigator !== "undefined" ? navigator : null;
		return {
			runtime: proc && proc.node ? "node " + proc.node : "browser",
			platform: proc && typeof process.platform === "string"
				? process.platform
				: (nav && nav.platform) || null,
			arch: proc && process.arch ? process.arch : null,
			userAgent: nav && nav.userAgent ? nav.userAgent : null,
			hardwareConcurrency: nav && nav.hardwareConcurrency ? nav.hardwareConcurrency : null,
			engine: AIIP.engine ? AIIP.engine.name + " " + AIIP.engine.version : null,
			worker: !!workerCtor(),
		};
	}

	function series(n, seed)
	{
		const len = Math.max(0, Math.round(n || 0));
		const rng = new AIIP.Random(Number.isFinite(seed) ? seed : 1);
		const classes = AIIP.data.CLASSES;
		const out = new Array(len);
		for (let i = 0; i < len; i++) {
			const c = classes[i % classes.length];
			out[i] = Math.round(rng.float(c.bpmMin, c.bpmMax) * 10) / 10;
		}
		return out;
	}

	function dataset(samples, seed, k)
	{
		const total = Math.max(3, Math.round(samples || 0));
		const perClass = Math.ceil(total / 3);
		const window = Math.max(1, Math.round(k || 4));
		const s = Number.isFinite(seed) ? seed : 1;
		const gen = AIIP.data.generateDataset({
			perClass,
			k: window,
			tol: TOL,
			seed: s,
		});
		const split = AIIP.data.splitSamples(gen.samples, TEST_PCT, new AIIP.Random(s + 1));
		return {
			train: split.train,
			test: split.test,
			all: gen.samples,
			meta: Object.assign({}, gen.meta, {
				samples: gen.samples.length,
				trainSize: split.train.length,
				testSize: split.test.length,
				testPct: TEST_PCT,
			}),
		};
	}

	function stats(runs)
	{
		const input = (runs || []).filter((v) => Number.isFinite(v));
		if (!input.length)
			return { runs: [], min: null, max: null, mean: null, median: null };
		const list = input.slice().sort((a, b) => a - b);
		const mid = list.length >> 1;
		const median = list.length % 2
			? list[mid]
			: (list[mid - 1] + list[mid]) / 2;
		return {
			runs: input.map(round3),
			min: round3(list[0]),
			max: round3(list[list.length - 1]),
			mean: round3(u.mean(input)),
			median: round3(median),
		};
	}

	function makeCase(id, title, param, unit, params, runs, notes)
	{
		const st = stats(runs);
		return {
			id,
			title,
			param,
			unit,
			params,
			runs: st.runs,
			min: st.min,
			max: st.max,
			mean: st.mean,
			median: st.median,
			notes: typeof notes === "function" ? notes() : (notes || ""),
		};
	}

	function enabledFilter(opts)
	{
		if (Array.isArray(opts.scenarios) && opts.scenarios.length)
			return (id) => opts.scenarios.indexOf(id) !== -1;
		return () => true;
	}

	async function run(opts, hooks)
	{
		opts = opts || {};
		hooks = hooks || {};
		const quick = !!opts.quick;
		const seed = Number.isFinite(opts.seed) ? opts.seed : 7;
		const notes = [];
		const defaults = quick ? QUICK_SIZES : SIZES;
		const legacy = opts.sizes || {};

		const sizes = {
			inference: sanitizeList(
				opts.seriesLengths !== undefined ? opts.seriesLengths : legacy.inference,
				"sequence length", LIMITS.series, defaults.inference, notes),
			evaluation: sanitizeList(
				opts.datasetSizes !== undefined ? opts.datasetSizes : legacy.evaluation,
				"dataset size", LIMITS.dataset, defaults.evaluation, notes),
			training: sanitizeList(
				opts.datasetSizes !== undefined ? opts.datasetSizes : legacy.training,
				"dataset size", LIMITS.dataset, defaults.training, notes),
			k: sanitizeList(legacy.k, "window K", LIMITS.k, defaults.k, notes),
			epochs: sanitizeList(legacy.epochs, "epochs", LIMITS.epochs,
				defaults.epochs, notes),
		};
		const baseK = sanitizeInt(opts.k, "window K", LIMITS.k, BASE_K, notes);
		const baseEpochs = sanitizeInt(opts.epochs, "training epochs",
			LIMITS.epochs, BASE_EPOCHS, notes);
		const repeats = sanitizeInt(opts.repeats, "repeats", LIMITS.repeats,
			5, notes);

		const enabled = enabledFilter(opts);
		const worker = workerCtor();
		const counts = {
			inference: sizes.inference.length,
			evaluation: sizes.evaluation.length,
			training: sizes.training.length,
			"window-k": sizes.k.length,
			epochs: sizes.epochs.length,
			"worker-main": worker ? 2 : 1,
		};
		let caseTotal = 0;
		for (const s of SCENARIOS)
			if (enabled(s.id))
				caseTotal += counts[s.id];

		const config = {
			quick,
			repeats,
			seed,
			warmup: 1,
			k: baseK,
			epochs: baseEpochs,
			sizes,
			testPct: TEST_PCT,
			tol: TOL,
			hidden: DEFAULTS.hidden,
			learningRate: DEFAULTS.learningRate,
			momentum: DEFAULTS.momentum,
		};
		const result = {
			meta: {
				startedAt: new Date().toISOString(),
				env: envInfo(),
				config,
				notes,
			},
			cases: [],
		};

		let caseIndex = 0;
		let lastYield = now();
		let aborted = false;
		const shouldStop = () => !!(hooks.shouldStop && hooks.shouldStop());

		async function pause()
		{
			if (now() - lastYield >= 16) {
				await u.nextFrame();
				lastYield = now();
			}
		}

		const hooksForTrain = { shouldStop };
		const models = new Map();

		async function trained(k, samples, epochs)
		{
			const key = k + ":" + samples + ":" + epochs;
			if (models.has(key))
				return models.get(key);
			const d = dataset(samples, seed + k * 131 + epochs, k);
			const model = new AIIP.RhythmModel({
				k,
				encoding: AIIP.RhythmModel.encodingFor(d.train),
			});
			await model.train(d.train, d.test, {
				epochs,
				hidden: DEFAULTS.hidden,
				learningRate: DEFAULTS.learningRate,
				momentum: DEFAULTS.momentum,
			}, hooksForTrain);
			const out = { model, data: d, encoding: model.encoding };
			models.set(key, out);
			return out;
		}

		function report(id, label, index, runNo)
		{
			if (!hooks.onProgress)
				return;
			hooks.onProgress({
				scenario: id,
				label,
				caseIndex: index,
				caseTotal,
				run: runNo,
				runs: repeats,
			});
		}

		function emit(c)
		{
			result.cases.push(c);
			if (hooks.onCase)
				hooks.onCase(c);
			caseIndex++;
		}

		async function timeCase(id, title, param, unit, params, label, notes, fn, prep, cleanup)
		{
			const index = caseIndex;
			const runs = [];
			await pause();
			let ctx = prep ? await prep(0) : undefined;
			try {
				await fn(0, true, ctx);
			} finally {
				if (cleanup)
					cleanup(ctx);
			}
			for (let i = 1; i <= repeats; i++) {
				if (shouldStop()) {
					aborted = true;
					break;
				}
				await pause();
				ctx = prep ? await prep(i) : undefined;
				const t0 = now();
				try {
					await fn(i, false, ctx);
				} finally {
					runs.push(round3(now() - t0));
					if (cleanup)
						cleanup(ctx);
				}
				report(id, label, index, i);
			}
			emit(makeCase(id, title, param, unit, params, runs, notes));
		}

		const small = {};
		if (enabled("inference") || enabled("evaluation"))
			small.main = await trained(baseK, 1000, 20);

		if (!shouldStop() && enabled("inference")) {
			for (const n of sizes.inference) {
				const s = series(n, seed + n);
				await timeCase("inference", "Inference vs sequence length", n, "BPM values",
					{ n, k: baseK }, "inference n=" + n,
					"predictSeries; " + (n - baseK + 1) + " windows; K=" + baseK,
					() => small.main.model.predictSeries(s));
				if (shouldStop())
					break;
			}
		}

		if (!shouldStop() && enabled("evaluation")) {
			for (const s of sizes.evaluation) {
				const d = dataset(s, seed + s, baseK);
				await timeCase("evaluation", "Evaluation vs dataset size", d.all.length,
					"samples", { samples: d.all.length, k: baseK },
					"evaluation s=" + d.all.length,
					"evaluate on " + d.all.length + " labelled samples; K=" + baseK,
					() => small.main.model.evaluate(d.all));
				if (shouldStop())
					break;
			}
		}

		if (!shouldStop() && enabled("training")) {
			for (const s of sizes.training) {
				const d = dataset(s, seed + s, baseK);
				const encoding = AIIP.RhythmModel.encodingFor(d.train);
				let path = "main-thread";
				await timeCase("training", "Training vs dataset size", d.all.length,
					"samples",
					{
						samples: d.all.length,
						trainSize: d.train.length,
						epochs: baseEpochs,
						hidden: DEFAULTS.hidden,
						k: baseK,
					},
					"training s=" + d.all.length,
					() => "epochs=" + baseEpochs + "; trainPath=" + path,
					async (i, warm, m) => {
						await m.train(d.train, d.test, {
							epochs: baseEpochs,
							hidden: DEFAULTS.hidden,
							learningRate: DEFAULTS.learningRate,
							momentum: DEFAULTS.momentum,
						}, hooksForTrain);
					},
					() => new AIIP.RhythmModel({ k: baseK, encoding }),
					(m) => {
						path = m.trainPath || "main-thread";
					});
				if (shouldStop())
					break;
			}
		}

		if (!shouldStop() && enabled("window-k")) {
			const s = series(50000, seed + 5000);
			for (const k of sizes.k) {
				const t = await trained(k, 1000, 10);
				await timeCase("window-k", "Window size K", k, "values",
					{ k, n: 50000 }, "window k=" + k,
					"predictSeries on N=50000; K=" + k + "; model trained per K",
					() => t.model.predictSeries(s));
				if (shouldStop())
					break;
			}
		}

		if (!shouldStop() && enabled("epochs")) {
			const d = dataset(5000, seed + 5000, baseK);
			const encoding = AIIP.RhythmModel.encodingFor(d.train);
			for (const epochs of sizes.epochs) {
				let path = "main-thread";
				await timeCase("epochs", "Training epochs", epochs, "epochs",
					{
						samples: d.all.length,
						epochs,
						hidden: DEFAULTS.hidden,
						k: baseK,
					},
					"epochs e=" + epochs,
					() => "S=5000; K=" + baseK + "; trainPath=" + path,
					async (i, warm, m) => {
						await m.train(d.train, d.test, {
							epochs,
							hidden: DEFAULTS.hidden,
							learningRate: DEFAULTS.learningRate,
							momentum: DEFAULTS.momentum,
						}, hooksForTrain);
					},
					() => new AIIP.RhythmModel({ k: baseK, encoding }),
					(m) => {
						path = m.trainPath || "main-thread";
					});
				if (shouldStop())
					break;
			}
		}

		if (!shouldStop() && enabled("worker-main")) {
			if (!worker) {
				emit(makeCase("worker-main", "Worker vs main thread", "worker/main", "ms",
					{ paths: ["worker", "main-thread"], samples: 5000, epochs: baseEpochs, k: baseK },
					[], "skipped: Worker unavailable (Node)"));
			} else {
				const d = dataset(5000, seed + 5000, baseK);
				const encoding = AIIP.RhythmModel.encodingFor(d.train);
				for (const mode of ["worker", "main-thread"]) {
					let path = null;
					await timeCase("worker-main", "Worker vs main thread", mode, "ms",
						{ path: mode, samples: d.all.length, epochs: baseEpochs, k: baseK },
						"worker path=" + mode,
						() => "trainPath=" + (path || "n/a") +
							(mode === "main-thread" ? "; forced fallback" : "; includes worker startup"),
						async (i, warm, scope) => {
							await scope.model.train(d.train, d.test, {
								epochs: baseEpochs,
								hidden: DEFAULTS.hidden,
								learningRate: DEFAULTS.learningRate,
								momentum: DEFAULTS.momentum,
							}, hooksForTrain);
						},
						() => {
							const saved = AIIP.trainWorkerMain;
							if (mode === "main-thread")
								AIIP.trainWorkerMain = undefined;
							return {
								model: new AIIP.RhythmModel({ k: baseK, encoding }),
								saved,
							};
						},
						(scope) => {
							path = scope.model.trainPath || "main-thread";
							if (mode === "main-thread")
								AIIP.trainWorkerMain = scope.saved;
						});
					if (shouldStop())
						break;
				}
			}
		}

		aborted = aborted || shouldStop();
		if (aborted)
			result.meta.stopped = true;
		return result;
	}

	function csvCell(v)
	{
		const s = v === null || v === undefined ? "" : String(v);
		return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
	}

	function toCsv(result)
	{
		const head = ["case", "title", "param", "unit", "params", "run", "ms",
			"min", "max", "mean", "median", "notes"];
		const lines = [head.join(",")];
		for (const c of (result && result.cases) || []) {
			const params = JSON.stringify(c.params || {});
			const base = [c.id, c.title, c.param, c.unit, params];
			if (c.runs && c.runs.length) {
				c.runs.forEach((ms, i) => {
					lines.push(base.concat([i + 1, ms, c.min, c.max, c.mean,
						c.median, c.notes]).map(csvCell).join(","));
				});
			} else {
				lines.push(base.concat(["", "", c.min, c.max, c.mean,
					c.median, c.notes]).map(csvCell).join(","));
			}
		}
		return lines.join("\n") + "\n";
	}

	function toJson(result)
	{
		return JSON.stringify(result, null, 2) + "\n";
	}

	AIIP.bench = {
		series,
		dataset,
		stats,
		SCENARIOS,
		run,
		toCsv,
		toJson,
	};
})();
