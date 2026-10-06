(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;
	const logger = () => AIIP.logger;
	const exportMod = () => AIIP.imageExport;

	function el(id)
	{
		return document.getElementById(id);
	}

	function setProgress(fill, wrap, text, pct, label)
	{
		fill.style.width = pct + "%";
		wrap.setAttribute("aria-valuenow", String(Math.round(pct)));
		text.textContent = label;
	}

	const FIELD_MAP = {
		"per-class": ["data-per-class"],
		k: ["data-k"],
		tol: ["data-tol"],
		"test-pct": ["data-test-pct"],
		seed: ["data-seed"],
		normal: ["range-normal-min", "range-normal-max"],
		tachycardia: ["range-tachy-min", "range-tachy-max"],
		bradycardia: ["range-brady-min", "range-brady-max"],
	};

	function clearFieldErrors()
	{
		for (const ids of Object.values(FIELD_MAP))
			for (const id of ids) {
				const f = el(id);
				if (f)
					f.classList.remove("field-error");
			}
	}

	function showErrors(box, errors)
	{
		if (!errors.length) {
			box.hidden = true;
			return;
		}
		box.innerHTML = "";
		const ul = document.createElement("ul");
		for (const e of errors) {
			const li = document.createElement("li");
			li.textContent = typeof e === "string" ? e : e.msg;
			ul.appendChild(li);
		}
		box.appendChild(ul);
		box.hidden = false;
		clearFieldErrors();
		const bad = [];
		for (const e of errors) {
			if (typeof e === "string")
				continue;
			for (const id of FIELD_MAP[e.field] || []) {
				const f = el(id);
				if (f && !bad.includes(f))
					bad.push(f);
			}
		}
		for (const f of bad)
			f.classList.add("field-error");
		if (bad.length)
			bad[0].focus();
		const first = errors[0];
		logger().error("dataset form: " + (typeof first === "string" ? first : first.msg));
	}

	function readRanges()
	{
		const ids = { normal: "normal", tachycardia: "tachy", bradycardia: "brady" };
		const r = {};
		for (const key of Object.keys(ids)) {
			r[key] = [
				Number(el("range-" + ids[key] + "-min").value),
				Number(el("range-" + ids[key] + "-max").value),
			];
		}
		return r;
	}

	function validate()
	{
		const f = {
			perClass: el("data-per-class"),
			k: el("data-k"),
			tol: el("data-tol"),
			testPct: el("data-test-pct"),
			seed: el("data-seed"),
		};
		const errors = [];
		const perClass = f.perClass.value.trim();
		if (!/^\d+$/.test(perClass) || +perClass < 10 || +perClass > 5000)
			errors.push({ field: "per-class", msg: "sequences per class must be an integer in 10..5000" });
		const k = f.k.value.trim();
		if (!/^\d+$/.test(k) || +k < 3 || +k > 12)
			errors.push({ field: "k", msg: "values per sequence (K) must be an integer in 3..12" });
		const tol = f.tol.value.trim();
		if (tol === "" || !isFinite(+tol) || +tol < 0 || +tol > 20)
			errors.push({ field: "tol", msg: "tolerance must be a number in 0..20" });
		const testPct = f.testPct.value.trim();
		if (!/^\d+$/.test(testPct) || +testPct < 5 || +testPct > 50)
			errors.push({ field: "test-pct", msg: "test split must be an integer in 5..50" });
		const seed = f.seed.value.trim();
		if (seed !== "" && (!/^\d+$/.test(seed) || +seed > 999999999))
			errors.push({ field: "seed", msg: "seed must be blank or an integer up to 999999999" });

		const ranges = readRanges();
		for (const key of ["normal", "tachycardia", "bradycardia"]) {
			const [lo, hi] = ranges[key];
			if (!isFinite(lo) || !isFinite(hi) || lo < 20 || hi > 300 || lo >= hi)
				errors.push({
					field: key,
					msg: key + " range must satisfy 20 <= min < max <= 300",
				});
		}
		return { errors, ranges };
	}

	function renderTiles(state)
	{
		const d = state.dataset;
		const tiles = el("data-tiles");
		const stats = AIIP.data.summarize(d.samples);
		tiles.innerHTML = "";

		const add = (label, value, sub) => {
			const t = document.createElement("div");
			t.className = "tile";
			const l = document.createElement("span");
			l.className = "tile-label";
			l.textContent = label;
			const v = document.createElement("span");
			v.className = "tile-value";
			v.textContent = value;
			t.appendChild(l);
			t.appendChild(v);
			if (sub !== undefined) {
				const s = document.createElement("span");
				s.className = "tile-sub";
				s.textContent = sub;
				t.appendChild(s);
			}
			tiles.appendChild(t);
		};

		add("sequences", String(d.samples.length), "3 classes");
		add("split", d.train.length + " / " + d.test.length,
			"train / test " + d.testPct + "%");
		add("window K", String(d.meta.k),
			"tolerance " + (d.meta.tol !== undefined && d.meta.tol !== null
				? u.fmtFixed(d.meta.tol, 1) : "\u2014") + " BPM");
		if (d.meta.seed !== undefined && d.meta.seed !== null)
			add("seed", String(d.meta.seed), "deterministic");
		for (const s of stats)
			add(s.label, String(s.count),
				u.fmtFixed(s.min, 1) + "\u2013" + u.fmtFixed(s.max, 1) + " BPM, mean " + u.fmtFixed(s.mean, 1));
		tiles.hidden = false;
	}

	function renderCharts(state)
	{
		const d = state.dataset;
		const lines = [
			{ value: 60, label: "60 BPM" },
			{ value: 100, label: "100 BPM" },
		];
		AIIP.charts.drawScatter(el("scatter-canvas"), d.samples, { lines });
		AIIP.charts.drawGallery(el("gallery-canvas"), d.samples, d.meta.k);
		el("scatter-placeholder").hidden = true;
		el("scatter-canvas").hidden = false;
		el("gallery-placeholder").hidden = true;
		el("gallery-canvas").hidden = false;
	}

	function updateGating(ctx)
	{
		const has = !!ctx.state.dataset;
		const busy = ctx.state.busy;
		el("data-generate").disabled = busy;
		el("data-save-csv").disabled = !has || busy;
		el("data-save-json").disabled = !has || busy;
		el("data-load-file").disabled = busy;
		el("data-save-hint").hidden = has;
	}

	function resetDownstream()
	{
		if (AIIP.trainStep)
			AIIP.trainStep.resetResults();
		if (AIIP.recognizeStep)
			AIIP.recognizeStep.resetResults();
	}

	async function generate(ctx)
	{
		const { errors, ranges } = validate();
		if (errors.length) {
			showErrors(el("data-errors"), errors);
			return;
		}
		el("data-errors").hidden = true;
		clearFieldErrors();

		const perClass = +el("data-per-class").value;
		const k = +el("data-k").value;
		const tol = +el("data-tol").value;
		const testPct = +el("data-test-pct").value;
		const seedRaw = el("data-seed").value.trim();
		const seed = seedRaw === "" ? AIIP.randomSeed() : +seedRaw;
		const fill = el("data-progress");
		const wrap = el("data-progress-wrap");
		const text = el("data-progress-text");
		fill.classList.remove("stopping");

		ctx.state.busy = true;
		ctx.refresh();

		try {
			setProgress(fill, wrap, text, 5, "generating sequences\u2026");
			await u.nextFrame();
			const dataset = AIIP.data.generateDataset({ perClass, k, tol, seed, ranges });
			setProgress(fill, wrap, text, 45, "generated " + dataset.samples.length + " sequences");
			await u.nextFrame();

			const rng = new AIIP.Random(seed);
			const split = AIIP.data.splitSamples(dataset.samples, testPct, rng);
			setProgress(fill, wrap, text, 60, "split " + split.train.length + " train / " + split.test.length + " test");
			await u.nextFrame();

			ctx.state.dataset = {
				samples: dataset.samples,
				train: split.train,
				test: split.test,
				testPct,
				meta: dataset.meta,
			};
			ctx.state.model = null;
			ctx.state.recognition = null;
			resetDownstream();

			setProgress(fill, wrap, text, 75, "summarizing\u2026");
			await u.nextFrame();
			renderTiles(ctx.state);
			renderCharts(ctx.state);
			setProgress(fill, wrap, text, 100,
				"done: " + dataset.samples.length + " sequences, K=" + k);

			if (dataset.samples.length < 250)
				logger().warning("dataset has " + dataset.samples.length +
					" sequences; 250+ recommended for training");
			logger().success("dataset generated: " + dataset.samples.length +
				" sequences (seed " + seed + ")");

			ctx.setStatus("data", "done",
				perClass + "\u00d73 \u00b7 K=" + k + " \u00b7 seed " + seed);
			ctx.setStatus("model", "empty", "not trained");
			ctx.setStatus("recognize", "empty", "no result yet");
		} catch (e) {
			showErrors(el("data-errors"), ["generate failed: " + e.message]);
			logger().error("generate failed: " + e.message);
		} finally {
			ctx.state.busy = false;
			ctx.refresh();
		}
	}

	async function loadFile(ctx, file)
	{
		if (!file)
			return;
		ctx.state.lastFile = file;
		ctx.state.busy = true;
		ctx.refresh();
		try {
			const text = await file.text();
			const isJson = /\.json$/i.test(file.name);
			let dataset = null;
			let errors = [];

			if (isJson) {
				const r = AIIP.data.parseDatasetJson(text);
				if (r.errors.length) {
					errors = r.errors.map((e) => e.message);
				} else {
					dataset = r.dataset;
				}
			} else {
				const r = AIIP.data.parseDatasetCsv(text);
				if (r.errors.length) {
					errors = r.errors.map((e) => "line " + e.line + ": " + e.message);
				} else {
					dataset = { samples: r.samples, meta: { k: r.k } };
				}
			}

			if (errors.length) {
				showErrors(el("data-errors"), errors);
				logger().error("dataset load failed: " + errors[0]);
				return;
			}
			el("data-errors").hidden = true;
			clearFieldErrors();

			const k = dataset.meta.k;
			const storedPct = dataset.meta.testPct;
			let testPct;
			let rng;
			if (isJson && Number.isInteger(storedPct) && storedPct >= 5 && storedPct <= 50) {
				testPct = storedPct;
				rng = dataset.meta.seed !== undefined && dataset.meta.seed !== null
					? new AIIP.Random(dataset.meta.seed)
					: new AIIP.Random(AIIP.randomSeed());
			} else {
				const formPct = +el("data-test-pct").value;
				testPct = Number.isInteger(formPct) && formPct >= 5 && formPct <= 50 ? formPct : 20;
				rng = new AIIP.Random(AIIP.randomSeed());
				logger().info("test split remade randomly (" +
					(isJson ? "file stores no split" : "CSV stores no split") + ")");
			}
			const split = AIIP.data.splitSamples(dataset.samples, testPct, rng);
			ctx.state.dataset = {
				samples: dataset.samples,
				train: split.train,
				test: split.test,
				testPct,
				meta: dataset.meta,
			};
			ctx.state.model = null;
			ctx.state.recognition = null;
			resetDownstream();

			el("data-k").value = String(k);
			renderTiles(ctx.state);
			renderCharts(ctx.state);
			if (dataset.samples.length < 250)
				logger().warning("dataset has " + dataset.samples.length +
					" sequences; 250+ recommended for training");
			logger().success("dataset loaded: " + dataset.samples.length +
				" sequences, K=" + k);
			ctx.setStatus("data", "done",
				dataset.samples.length + " seq \u00b7 K=" + k + " \u00b7 file");
			ctx.setStatus("model", "empty", "not trained");
			ctx.setStatus("recognize", "empty", "no result yet");
		} catch (e) {
			showErrors(el("data-errors"), ["dataset load failed: " + e.message]);
			logger().error("dataset load failed: " + e.message);
		} finally {
			ctx.state.busy = false;
			ctx.refresh();
		}
	}

	function init(ctx)
	{
		el("data-generate").addEventListener("click", () => generate(ctx));
		el("data-load-file").addEventListener("click", () => el("data-file-input").click());
		el("data-file-input").addEventListener("change", (ev) => {
			loadFile(ctx, ev.target.files[0]);
			ev.target.value = "";
		});
		el("data-save-csv").addEventListener("click", () => {
			const d = ctx.state.dataset;
			if (!d)
				return;
			const name = "ecg_dataset_K" + d.meta.k + "_" + u.timestamp() + ".csv";
			const r = exportMod().saveText(AIIP.data.datasetToCsvText(d), name);
			ctx.state.lastSave = r;
			logger().success("dataset saved: " + r.name + " (" + u.fmtBytes(r.size) + ")");
		});
		el("data-save-json").addEventListener("click", () => {
			const d = ctx.state.dataset;
			if (!d)
				return;
			const meta = Object.assign({}, d.meta, { testPct: d.testPct });
			const name = "ecg_dataset_K" + d.meta.k + "_" + u.timestamp() + ".json";
			const r = exportMod().saveText(AIIP.data.datasetToJsonText({ samples: d.samples, meta }), name);
			ctx.state.lastSave = r;
			logger().success("dataset saved: " + r.name + " (" + u.fmtBytes(r.size) + ")");
		});
	}

	AIIP.dataStep = { init, updateGating, renderTiles, renderCharts };
})();
