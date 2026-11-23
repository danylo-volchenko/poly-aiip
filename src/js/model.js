(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const ENGINE = "brain.js";
	// Bundled version at vendoring time; detectEngineVersion() prefers the
	// real version banner carried by the vendored bundle.
	const ENGINE_VERSION = "2.0.0-beta.24";
	const WORKER_IDLE_MS = 120000;
	const DEFAULTS = { learningRate: 0.3, momentum: 0.1, hidden: 8 };

	function now()
	{
		return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
	}

	function emptyHistory()
	{
		return { epoch: [], error: [], evalEpoch: [], trainAcc: [], testAcc: [] };
	}

	function getBrain()
	{
		const g = typeof globalThis !== "undefined" ? globalThis : null;
		const b = (g && g.brain) || (typeof window !== "undefined" ? window.brain : null);
		if (!b || typeof b.NeuralNetwork !== "function")
			throw new Error("brain.js is not loaded");
		return b;
	}

	function getBrainSource()
	{
		return typeof window !== "undefined" && typeof window.__BRAIN_SOURCE__ === "string"
			? window.__BRAIN_SOURCE__
			: "";
	}

	// brain.js exports no version of its own, so read the banner comment of the
	// vendored bundle; ENGINE_VERSION is only a fallback when no source is loaded.
	function detectEngineVersion()
	{
		const g = typeof globalThis !== "undefined" ? globalThis : null;
		const b = (g && g.brain) || (typeof window !== "undefined" ? window.brain : null);
		if (b && typeof b.version === "string" && b.version)
			return b.version;
		const m = /brain\.js\s+v?([0-9][\w.\-]*)/.exec(getBrainSource());
		return m ? m[1] : ENGINE_VERSION;
	}

	function oneHot(label)
	{
		const out = {};
		for (const c of AIIP.data.CLASSES)
			out[c.key] = c.key === label ? 1 : 0;
		return out;
	}

	function encodeSet(set, model)
	{
		const rows = set.map((s) => ({
			input: s.bpm.map((v) => model.encode(v)),
			output: oneHot(s.label),
		}));
		const labels = set.map((s) => AIIP.data.CLASSES.findIndex((c) => c.key === s.label));
		return { rows, labels };
	}

	function accuracyOf(net, set, keys)
	{
		if (!net || !set || !set.rows.length)
			return null;
		let hits = 0;
		for (let i = 0; i < set.rows.length; i++) {
			const out = net.run(set.rows[i].input);
			const vals = Array.isArray(out) ? out : keys.map((k) => out[k] || 0);
			if (u.argmax(vals) === set.labels[i])
				hits++;
		}
		return hits / set.rows.length;
	}

	class RhythmModel
	{
		constructor(opts)
		{
			opts = opts || {};
			this.k = opts.k;
			this.encoding = opts.encoding || { min: 30, max: 150 };
			this.hidden = opts.hidden || DEFAULTS.hidden;
			this.learningRate = opts.learningRate || DEFAULTS.learningRate;
			this.momentum = Number.isFinite(opts.momentum) ? opts.momentum : DEFAULTS.momentum;
			this.net = null;
			this.history = emptyHistory();
			this.source = "trained";
			this.trainPath = null;
			this.trainSize = 0;
			this.testSize = 0;
			this.trainedAt = null;
		}

		encode(v)
		{
			const e = this.encoding;
			return u.clamp((v - e.min) / (e.max - e.min), 0, 1);
		}

		predictWindow(bpm)
		{
			if (!bpm || !bpm.length)
				throw new Error("empty window");
			if (!this.net)
				throw new Error("model is not trained");
			const classes = AIIP.data.CLASSES;
			const out = this.net.run(bpm.map((v) => this.encode(v)));
			const raw = Array.isArray(out)
				? classes.map((c, i) => Number(out[i]) || 0)
				: classes.map((c) => Number(out[c.key]) || 0);
			const total = raw.reduce((a, b) => a + b, 0);
			const probs = total > 0 ? raw.map((v) => v / total) : raw;
			const index = u.argmax(probs);
			return {
				probs,
				index,
				label: classes[index].key,
				confidence: probs[index],
			};
		}

		predictSeries(bpm)
		{
			if (!bpm || bpm.length < this.k)
				throw new Error(`sequence shorter than window size k=${this.k}`);
			const n = bpm.length - this.k + 1;
			const sums = AIIP.data.CLASSES.map(() => 0);
			const perWindow = [];
			for (let i = 0; i < n; i++) {
				const w = this.predictWindow(bpm.slice(i, i + this.k));
				perWindow.push({ probs: w.probs, index: w.index, label: w.label, confidence: w.confidence });
				for (let c = 0; c < sums.length; c++)
					sums[c] += w.probs[c];
			}
			const probs = sums.map((s) => s / n);
			const index = u.argmax(probs);
			return {
				windows: n,
				probs,
				index,
				label: AIIP.data.CLASSES[index].key,
				confidence: probs[index],
				perWindow,
			};
		}

		accuracy(samples)
		{
			if (!samples.length)
				return 0;
			let hits = 0;
			for (const s of samples) {
				const r = this.predictSeries(s.bpm);
				if (r.label === s.label)
					hits++;
			}
			return hits / samples.length;
		}

		recordProgress(msg)
		{
			this.history.epoch.push(msg.epoch);
			this.history.error.push(msg.error);
			if (msg.trainAcc !== null && msg.trainAcc !== undefined) {
				this.history.evalEpoch.push(msg.epoch);
				this.history.trainAcc.push(msg.trainAcc);
				this.history.testAcc.push(msg.testAcc);
			}
		}

		trainInWorker(data, config, evalEvery, hooks)
		{
			const g = typeof globalThis !== "undefined" ? globalThis : null;
			const WorkerCtor = (g && g.Worker) || (typeof window !== "undefined" && window.Worker) || null;
			const main = AIIP.trainWorkerMain;
			const source = getBrainSource();
			if (typeof WorkerCtor !== "function" || typeof main !== "function" || !source ||
				typeof Blob !== "function" || typeof URL === "undefined" || !URL.createObjectURL)
				return null;

			let worker = null;
			let url = null;
			try {
				const src = source + "\n;(" + main.toString() + ")();\n";
				url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
				worker = new WorkerCtor(url);
			} catch (e) {
				if (url) {
					try {
						URL.revokeObjectURL(url);
					} catch (ignored) {
						url = null;
					}
				}
				return null;
			}

			return new Promise((resolve) => {
				let settled = false;
				let idle = null;
				const finish = (value) => {
					if (settled)
						return;
					settled = true;
					if (idle !== null)
						clearTimeout(idle);
					try {
						worker.terminate();
					} catch (ignored) {
						worker = null;
					}
					try {
						URL.revokeObjectURL(url);
					} catch (ignored) {
						url = null;
					}
					resolve(value);
				};
				// A worker killed without an event would otherwise leave the
				// promise pending forever; time out and let the chunked
				// main-thread path take over.
				const bump = () => {
					if (idle !== null)
						clearTimeout(idle);
					idle = setTimeout(() => finish(null), WORKER_IDLE_MS);
				};

				worker.onmessage = (ev) => {
					bump();
					const msg = ev.data || {};
					if (msg.type === "progress") {
						if (hooks.onEpoch)
							hooks.onEpoch({
								epoch: msg.epoch,
								epochs: config.epochs,
								error: msg.error,
								trainAcc: msg.trainAcc,
								testAcc: msg.testAcc,
							});
						if (hooks.shouldStop && hooks.shouldStop())
							worker.postMessage({ type: "stop" });
					} else if (msg.type === "done") {
						finish(msg);
					} else if (msg.type === "error") {
						finish(null);
					}
				};
				worker.onerror = () => finish(null);
				worker.onmessageerror = () => finish(null);
				bump();
				try {
					worker.postMessage({
						type: "train",
						data,
						config,
						evalEvery,
						trainSize: this.trainSize,
						testSize: this.testSize,
					});
				} catch (e) {
					finish(null);
				}
			});
		}

		async trainChunked(data, config, evalEvery, hooks)
		{
			const net = this.net;
			const trainOpts = {
				iterations: 1,
				learningRate: config.learningRate,
				momentum: config.momentum,
				log: false,
			};
			let lastYield = now();

			for (let e = 1; e <= config.epochs; e++) {
				const error = net.train(data.train.rows, trainOpts).error;
				let trainAcc = null;
				let testAcc = null;
				if (e === 1 || e % evalEvery === 0 || e === config.epochs) {
					trainAcc = accuracyOf(net, data.train, config.keys);
					testAcc = accuracyOf(net, data.test, config.keys);
				}
				this.recordProgress({ epoch: e, error, trainAcc, testAcc });
				if (hooks.onEpoch)
					hooks.onEpoch({
						epoch: e,
						epochs: config.epochs,
						error,
						trainAcc,
						testAcc,
					});
				if (config.errorThresh > 0 && error <= config.errorThresh)
					break;
				if (hooks.shouldStop && hooks.shouldStop())
					break;
				if (now() - lastYield > 16) {
					await u.nextFrame();
					lastYield = now();
				}
			}
		}

		async train(trainSet, testSet, opts, hooks)
		{
			opts = opts || {};
			hooks = hooks || {};
			const brain = getBrain();

			const epochs = Math.max(1, opts.epochs || 1);
			const errorThresh = opts.errorThresh > 0 ? opts.errorThresh : 0;
			this.hidden = Math.max(1, Math.round(opts.hidden || DEFAULTS.hidden));
			this.learningRate = opts.learningRate > 0 ? opts.learningRate : DEFAULTS.learningRate;
			this.momentum = Number.isFinite(opts.momentum) ? opts.momentum : DEFAULTS.momentum;
			this.history = emptyHistory();
			this.trainSize = trainSet.length;
			this.testSize = testSet.length;
			this.trainedAt = null;

			const keys = AIIP.data.CLASSES.map((c) => c.key);
			const layers = {
				inputSize: this.k,
				hiddenLayers: [this.hidden],
				outputSize: keys.length,
			};
			const config = {
				epochs,
				errorThresh,
				learningRate: this.learningRate,
				momentum: this.momentum,
				hidden: this.hidden,
				layers,
				keys,
			};
			const data = {
				train: encodeSet(trainSet, this),
				test: encodeSet(testSet, this),
			};
			const evalEvery = Math.max(1, Math.round(epochs / 100));

			this.net = new brain.NeuralNetwork(layers);

			const worker = this.trainInWorker(data, config, evalEvery, hooks);
			const done = worker ? await worker : null;
			if (done && done.netJSON) {
				this.net.fromJSON(done.netJSON);
				if (done.history)
					this.history = done.history;
				this.trainPath = "worker";
			} else {
				this.history = emptyHistory();
				await this.trainChunked(data, config, evalEvery, hooks);
				this.trainPath = "main-thread";
			}

			this.trainedAt = new Date().toISOString();
			return this.history;
		}

		async evaluate(samples, hooks)
		{
			hooks = hooks || {};
			const keys = AIIP.data.CLASSES.map((c) => c.key);
			const idx = new Map(keys.map((k, i) => [k, i]));
			const cm = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
			const misclassified = [];
			const every = Math.max(1, Math.ceil(samples.length / 40));
			let lastYield = now();
			let hits = 0;
			let ce = 0;

			for (let i = 0; i < samples.length; i++) {
				const s = samples[i];
				const r = this.predictSeries(s.bpm);
				const truth = idx.get(s.label);
				cm[truth][r.index]++;
				if (r.index === truth) {
					hits++;
				} else {
					misclassified.push({
						bpm: s.bpm,
						label: s.label,
						predicted: r.label,
						mean: Math.round(u.mean(s.bpm) * 10) / 10,
					});
				}
				ce -= Math.log(Math.max(r.probs[truth], 1e-12));
				if ((i + 1) % every === 0 || i + 1 === samples.length) {
					if (hooks.onProgress)
						hooks.onProgress(i + 1, samples.length);
					if (now() - lastYield > 16) {
						await u.nextFrame();
						lastYield = now();
					}
				}
			}

			const perClass = keys.map((key, i) => {
				const tp = cm[i][i];
				const fp = cm[0][i] + cm[1][i] + cm[2][i] - tp;
				const fn = cm[i][0] + cm[i][1] + cm[i][2] - tp;
				const precision = tp + fp ? tp / (tp + fp) : 0;
				const recall = tp + fn ? tp / (tp + fn) : 0;
				const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
				return { key, precision, recall, f1, support: tp + fn };
			});

			return {
				confusion: cm,
				perClass,
				accuracy: samples.length ? hits / samples.length : 0,
				macroF1: u.mean(perClass.map((c) => c.f1)),
				crossEntropy: ce / (samples.length || 1),
				misclassified,
			};
		}

		toJSON()
		{
			return {
				format: "aiip-model",
				version: 2,
				engine: ENGINE,
				k: this.k,
				hidden: this.hidden,
				learningRate: this.learningRate,
				momentum: this.momentum,
				encoding: this.encoding,
				history: this.history,
				trainSize: this.trainSize,
				testSize: this.testSize,
				trainedAt: this.trainedAt,
				net: this.net ? this.net.toJSON() : null,
			};
		}

		static encodingFor(samples)
		{
			const vals = samples.flatMap((s) => s.bpm);
			if (!vals.length)
				return { min: 30, max: 150 };
			const lo = Math.floor((u.min(vals) - 10) / 10) * 10;
			const hi = Math.ceil((u.max(vals) + 10) / 10) * 10;
			return { min: lo, max: hi };
		}

		static fromJSON(obj)
		{
			if (!obj || obj.format !== "aiip-model")
				throw new Error("not an AIIP model file");
			if (obj.version !== 2 || obj.engine !== ENGINE)
				throw new Error("unsupported model version");
			if (!Number.isInteger(obj.k) || obj.k < 1)
				throw new Error("bad k");
			const e = obj.encoding;
			if (!e || !Number.isFinite(e.min) || !Number.isFinite(e.max) || e.min >= e.max)
				throw new Error("bad encoding");
			if (!obj.net || typeof obj.net !== "object")
				throw new Error("bad network");

			const m = new RhythmModel({
				k: obj.k,
				encoding: { min: e.min, max: e.max },
				hidden: obj.hidden,
				learningRate: obj.learningRate,
				momentum: obj.momentum,
			});
			m.net = new (getBrain().NeuralNetwork)();
			m.net.fromJSON(obj.net);
			m.history = obj.history && Array.isArray(obj.history.epoch) ? obj.history
				: emptyHistory();
			m.trainSize = obj.trainSize || 0;
			m.testSize = obj.testSize || 0;
			m.trainedAt = obj.trainedAt || null;
			m.source = "file";
			return m;
		}
	}

	AIIP.RhythmModel = RhythmModel;
	AIIP.engine = { name: ENGINE, version: detectEngineVersion() };
})();
