(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const TEMP = 5;
	const GRID = 5;
	const TIE = 1e-9;

	function softmax(z)
	{
		const m = u.max(z);
		const e = z.map((v) => Math.exp(v - m));
		const s = e.reduce((a, b) => a + b, 0);
		return e.map((v) => v / s);
	}

	function scoreByKey(b, mean)
	{
		return {
			normal: 0,
			tachycardia: (mean - b.high) / TEMP - TIE,
			bradycardia: (b.low - mean) / TEMP - TIE,
		};
	}

	function classifyKey(b, mean)
	{
		if (mean < b.low)
			return "bradycardia";
		if (mean > b.high)
			return "tachycardia";
		return "normal";
	}

	function linspace(a, b, n)
	{
		if (a === b)
			return Array(n).fill(a);
		const step = (b - a) / (n - 1);
		return Array.from({ length: n }, (_, i) => a + i * step);
	}

	function now()
	{
		return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
	}

	class RhythmModel
	{
		constructor(opts)
		{
			this.k = opts && opts.k;
			this.boundaries = (opts && opts.boundaries) || { low: 60, high: 100 };
			this.encoding = (opts && opts.encoding) || { min: 30, max: 150 };
			this.history = { epoch: [], error: [], evalEpoch: [], trainAcc: [], testAcc: [] };
			this.source = "trained";
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
			const classes = AIIP.data.CLASSES;
			const m = u.mean(bpm);
			const scores = scoreByKey(this.boundaries, m);
			const probs = softmax(classes.map((c) => scores[c.key]));
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

		accuracyWith(b, samples)
		{
			if (!samples.length)
				return 0;
			let hits = 0;
			for (const s of samples) {
				if (classifyKey(b, u.mean(s.bpm)) === s.label)
					hits++;
			}
			return hits / samples.length;
		}

		classMeans(trainSet)
		{
			const means = {};
			for (const c of AIIP.data.CLASSES) {
				const vals = trainSet.filter((s) => s.label === c.key).flatMap((s) => s.bpm);
				means[c.key] = vals.length ? u.mean(vals) : null;
			}
			return means;
		}

		initBoxes(trainSet)
		{
			const m = this.classMeans(trainSet);
			const low = m.bradycardia !== null && m.normal !== null && m.bradycardia < m.normal
				? [m.bradycardia, m.normal] : [40, 70];
			const high = m.normal !== null && m.tachycardia !== null && m.normal < m.tachycardia
				? [m.normal, m.tachycardia] : [90, 140];
			return { low, high };
		}

		async train(trainSet, testSet, opts, hooks)
		{
			const epochs = opts.epochs;
			const errorThresh = opts.errorThresh || 0;
			hooks = hooks || {};
			this.history = { epoch: [], error: [], evalEpoch: [], trainAcc: [], testAcc: [] };
			this.trainSize = trainSet.length;
			this.testSize = testSet.length;

			let boxes = this.initBoxes(trainSet);
			const evalEvery = Math.max(1, Math.round(epochs / 100));
			let lastYield = now();

			for (let e = 1; e <= epochs; e++) {
				let best = null;
				for (const low of linspace(boxes.low[0], boxes.low[1], GRID)) {
					for (const high of linspace(boxes.high[0], boxes.high[1], GRID)) {
						const acc = this.accuracyWith({ low, high }, trainSet);
						if (!best || acc > best.acc)
							best = { low, high, acc };
					}
				}

				this.boundaries = { low: best.low, high: best.high };
				const error = 1 - best.acc;
				const isEval = e === 1 || e % evalEvery === 0 || e === epochs;
				let testAcc = null;
				if (isEval) {
					testAcc = this.accuracyWith(this.boundaries, testSet);
					this.history.evalEpoch.push(e);
					this.history.testAcc.push(testAcc);
				}
				this.history.epoch.push(e);
				this.history.error.push(error);
				this.history.trainAcc.push(best.acc);

				if (hooks.onEpoch)
					hooks.onEpoch({
						epoch: e,
						epochs,
						error,
						trainAcc: best.acc,
						testAcc,
						boundaries: this.boundaries,
					});

				boxes = {
					low: shrinkBox(boxes.low, best.low),
					high: shrinkBox(boxes.high, best.high),
				};

				if (errorThresh > 0 && error <= errorThresh)
					break;
				if (hooks.shouldStop && hooks.shouldStop())
					break;
				if (now() - lastYield > 16) {
					await u.nextFrame();
					lastYield = now();
				}
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
				version: 1,
				engine: "threshold",
				k: this.k,
				boundaries: this.boundaries,
				encoding: this.encoding,
				history: this.history,
				trainSize: this.trainSize,
				testSize: this.testSize,
				trainedAt: this.trainedAt,
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
			if (!Number.isInteger(obj.k) || obj.k < 1)
				throw new Error("bad k");
			const b = obj.boundaries;
			if (!b || !Number.isFinite(b.low) || !Number.isFinite(b.high) || b.low >= b.high)
				throw new Error("bad boundaries");
			const e = obj.encoding;
			if (!e || !Number.isFinite(e.min) || !Number.isFinite(e.max) || e.min >= e.max)
				throw new Error("bad encoding");

			const m = new RhythmModel({
				k: obj.k,
				boundaries: { low: b.low, high: b.high },
				encoding: { min: e.min, max: e.max },
			});
			m.history = obj.history && Array.isArray(obj.history.epoch) ? obj.history
				: { epoch: [], error: [], evalEpoch: [], trainAcc: [], testAcc: [] };
			m.trainSize = obj.trainSize || 0;
			m.testSize = obj.testSize || 0;
			m.trainedAt = obj.trainedAt || null;
			m.source = "file";
			return m;
		}
	}

	function shrinkBox(box, best)
	{
		const step = (box[1] - box[0]) / 8;
		return [Math.max(0, best - step), best + step];
	}

	AIIP.RhythmModel = RhythmModel;
})();
