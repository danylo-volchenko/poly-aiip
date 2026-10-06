(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const CLASSES = [
		{ key: "bradycardia", label: "Bradycardia", color: "#009e73", bpmMin: 40, bpmMax: 60 },
		{ key: "normal", label: "Normal", color: "#0072b2", bpmMin: 60, bpmMax: 100 },
		{ key: "tachycardia", label: "Tachycardia", color: "#e69f00", bpmMin: 100, bpmMax: 140 },
	];

	const CLASS_MAP = new Map(CLASSES.map((c) => [c.key, c]));

	function classByKey(key)
	{
		return CLASS_MAP.get(key) || null;
	}

	function round1(v)
	{
		return Math.round(v * 10) / 10;
	}

	function generateDataset(config)
	{
		const rng = new AIIP.Random(config.seed);
		const k = config.k;
		const tol = config.tol;
		const ranges = {};
		const samples = [];
		const counts = {};

		for (const c of CLASSES) {
			const r = (config.ranges && config.ranges[c.key]) || [c.bpmMin, c.bpmMax];
			ranges[c.key] = r;
			counts[c.key] = 0;
			for (let i = 0; i < config.perClass; i++) {
				const tMax = rng.float(r[0], r[1]);
				const tMin = tMax - rng.float(0, tol);
				const bpm = [];
				for (let j = 0; j < k; j++)
					bpm.push(round1(rng.pick([tMax, tMin])));
				samples.push({ label: c.key, bpm });
				counts[c.key]++;
			}
		}

		return {
			samples,
			meta: {
				k,
				tol,
				seed: config.seed,
				perClass: config.perClass,
				ranges,
				counts,
			},
		};
	}

	function splitSamples(samples, testPct, rng)
	{
		const train = [];
		const test = [];

		for (const c of CLASSES) {
			const group = samples.filter((s) => s.label === c.key);
			const shuffled = rng.shuffle(group.slice());
			const nTest = Math.ceil(group.length * testPct / 100);
			test.push(...shuffled.slice(0, nTest));
			train.push(...shuffled.slice(nTest));
		}

		return { train, test };
	}

	function summarize(samples)
	{
		return CLASSES.map((c) => {
			const vals = samples.filter((s) => s.label === c.key)
				.flatMap((s) => s.bpm);
			return {
				key: c.key,
				label: c.label,
				count: samples.filter((s) => s.label === c.key).length,
				min: vals.length ? u.min(vals) : null,
				max: vals.length ? u.max(vals) : null,
				mean: vals.length ? round1(u.mean(vals)) : null,
			};
		});
	}

	function datasetToCsvText(dataset)
	{
		const k = dataset.meta.k;
		const head = "label" + Array.from({ length: k }, (_, i) => `,v${i + 1}`).join("");
		const lines = dataset.samples.map((s) => {
			const vals = s.bpm.map((v) => u.fmtFixed(v, 1)).join(",");
			return `${s.label},${vals}`;
		});
		return [head, ...lines].join("\n") + "\n";
	}

	function parseDatasetCsv(text)
	{
		const lines = text.split(/\r?\n/);
		const samples = [];
		const errors = [];
		let k = 0;

		lines.forEach((line, idx) => {
			const no = idx + 1;
			const s = line.trim();
			if (!s)
				return;
			if (no === 1 && /^label,/.test(s))
				return;
			const fields = s.split(",").map((f) => f.trim());
			const label = fields[0];
			const vals = fields.slice(1);

			if (!CLASS_MAP.has(label)) {
				errors.push({ line: no, message: `unknown class "${label}"` });
				return;
			}
			if (!k) {
				if (vals.length < 1) {
					errors.push({ line: no, message: "expected at least 1 value" });
					return;
				}
				k = vals.length;
			} else if (vals.length !== k) {
				errors.push({ line: no, message: `expected ${k} values, got ${vals.length}` });
				return;
			}
			const bpm = [];
			for (const v of vals) {
				const n = Number(v);
				if (!Number.isFinite(n)) {
					errors.push({ line: no, message: `"${v}" is not a number` });
					return;
				}
				bpm.push(n);
			}
			samples.push({ label, bpm });
		});

		return { samples, k, errors };
	}

	function datasetToJsonText(dataset)
	{
		return JSON.stringify({
			format: "aiip-dataset",
			version: 1,
			meta: dataset.meta,
			samples: dataset.samples,
		}, null, 2) + "\n";
	}

	function parseDatasetJson(text)
	{
		let obj;

		try {
			obj = JSON.parse(text);
		} catch (e) {
			return { dataset: null, errors: [{ line: 0, message: `invalid JSON: ${e.message}` }] };
		}

		if (!obj || obj.format !== "aiip-dataset") {
			return { dataset: null, errors: [{ line: 0, message: "not an AIIP dataset file" }] };
		}

		const samples = [];
		const errors = [];
		const k = obj.meta && obj.meta.k;

		if (!Array.isArray(obj.samples)) {
			return { dataset: null, errors: [{ line: 0, message: "samples missing" }] };
		}

		obj.samples.forEach((s, idx) => {
			const no = idx + 1;
			if (!s || typeof s.label !== "string" || !CLASS_MAP.has(s.label)) {
				errors.push({ line: no, message: "unknown or missing class" });
				return;
			}
			if (!Array.isArray(s.bpm) || !s.bpm.length ||
				!s.bpm.every((v) => Number.isFinite(v))) {
				errors.push({ line: no, message: "bpm must be a non-empty array of numbers" });
				return;
			}
			if (k && s.bpm.length !== k) {
				errors.push({ line: no, message: `expected ${k} values, got ${s.bpm.length}` });
				return;
			}
			samples.push({ label: s.label, bpm: s.bpm });
		});

		return { dataset: { samples, meta: obj.meta || {} }, errors };
	}

	const EXAMPLES = [
		{ key: "normal", label: "Normal", bpm: [72, 68, 75, 71, 69, 73, 70, 68, 74] },
		{ key: "tachycardia", label: "Tachycardia", bpm: [95, 100, 104, 104, 102, 104, 104, 101, 96] },
		{ key: "bradycardia", label: "Bradycardia", bpm: [50, 49, 49, 51, 51] },
	];

	function exampleByKey(key)
	{
		return EXAMPLES.find((e) => e.key === key) || null;
	}

	AIIP.data = {
		CLASSES,
		CLASS_MAP,
		classByKey,
		generateDataset,
		splitSamples,
		summarize,
		datasetToCsvText,
		parseDatasetCsv,
		datasetToJsonText,
		parseDatasetJson,
		EXAMPLES,
		exampleByKey,
	};
})();
