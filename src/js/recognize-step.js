(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;
	const logger = () => AIIP.logger;

	const MAX_VALUES = 200;

	function el(id)
	{
		return document.getElementById(id);
	}

	function showErrors(errors)
	{
		const box = el("recognize-errors");
		if (!errors.length) {
			box.hidden = true;
			return;
		}
		box.innerHTML = "";
		const ul = document.createElement("ul");
		for (const e of errors) {
			const li = document.createElement("li");
			li.textContent = e;
			ul.appendChild(li);
		}
		box.appendChild(ul);
		box.hidden = false;
		logger().error("recognize form: " + errors[0]);
	}

	function showWarnings(warnings)
	{
		const box = el("recognize-warnings");
		if (!warnings.length) {
			box.hidden = true;
			return;
		}
		box.innerHTML = "";
		const ul = document.createElement("ul");
		for (const w of warnings) {
			const li = document.createElement("li");
			li.textContent = w;
			ul.appendChild(li);
		}
		box.appendChild(ul);
		box.hidden = false;
	}

	function parseSequence(text, unit)
	{
		const parts = text.split(/[\s,;]+/).filter((p) => p.length > 0);
		const errors = [];
		const values = [];
		for (const p of parts) {
			const v = Number(p);
			if (!isFinite(v))
				errors.push("not a number: \"" + p + "\"");
			else if (unit === "bpm" && (v < 20 || v > 300))
				errors.push(u.fmtFixed(v, 1) + " BPM is outside 20..300");
			else if (unit === "rrms" && (v < 200 || v > 3000))
				errors.push(Math.round(v) + " ms is outside 200..3000");
			else
				values.push(v);
		}
		return { errors, raw: values };
	}

	function toBpmValues(raw, unit)
	{
		return unit === "rrms" ? raw.map((v) => u.toBpm(v)) : raw;
	}

	function renderResultPanel(rec, unit)
	{
		const panel = el("recognize-result");
		panel.innerHTML = "";

		const label = document.createElement("div");
		label.className = "result-label class-" + rec.label;
		label.textContent = rec.label.toUpperCase();
		panel.appendChild(label);

		const conf = document.createElement("div");
		conf.className = "result-confidence";
		conf.textContent = "confidence " + u.fmtFixed(rec.confidence * 100, 1) + "%" +
			" \u00b7 " + rec.windows + " windows \u00b7 " + rec.bpm.length +
			" values (" + (unit === "bpm" ? "BPM" : "RR ms") + " input)";
		panel.appendChild(conf);

		const bars = document.createElement("div");
		bars.className = "prob-bars";
		AIIP.data.CLASSES.forEach((c, i) => {
			const row = document.createElement("div");
			row.className = "prob-row";
			const name = document.createElement("span");
			name.className = "class-" + c.key;
			name.textContent = c.label;
			const track = document.createElement("div");
			track.className = "prob-track";
			const fill = document.createElement("div");
			fill.className = "prob-fill";
			fill.style.width = (rec.probs[i] * 100) + "%";
			fill.style.background = c.color;
			track.appendChild(fill);
			const val = document.createElement("span");
			val.textContent = u.fmtFixed(rec.probs[i] * 100, 1) + "%";
			row.appendChild(name);
			row.appendChild(track);
			row.appendChild(val);
			bars.appendChild(row);
		});
		panel.appendChild(bars);
		panel.hidden = false;
	}

	function renderWindowTable(rec)
	{
		const box = el("window-table");
		box.innerHTML = "";
		const table = document.createElement("table");
		const head = document.createElement("tr");
		for (const h of ["window", "values", "mean BPM", "prediction", "confidence"]) {
			const th = document.createElement("th");
			th.textContent = h;
			head.appendChild(th);
		}
		table.appendChild(head);
		rec.perWindow.forEach((w, i) => {
			const tr = document.createElement("tr");
			const vals = rec.bpm.slice(i, i + rec.k)
				.map((v) => u.fmtFixed(v, 1)).join(", ");
			const mean = u.mean(rec.bpm.slice(i, i + rec.k));
			const cells = [
				String(i + 1),
				vals,
				u.fmtFixed(mean, 1),
				w.label,
				u.fmtFixed(w.confidence * 100, 1) + "%",
			];
			for (const c of cells) {
				const td = document.createElement("td");
				td.textContent = c;
				tr.appendChild(td);
			}
			table.appendChild(tr);
		});
		box.appendChild(table);
		box.hidden = false;
	}

	function buildResultText(rec, model, warnings, unit)
	{
		const lines = [];
		lines.push("AIIP heart rhythm recognition result");
		lines.push("date: " + new Date().toISOString());
		lines.push("");
		lines.push("input (" + (unit === "bpm" ? "BPM" : "RR ms") + "): " +
			rec.raw.map((v) => unit === "bpm" ? u.fmtFixed(v, 1) : String(Math.round(v))).join(", "));
		lines.push("input as BPM: " + rec.bpm.map((v) => u.fmtFixed(v, 1)).join(", "));
		lines.push("");
		lines.push("prediction: " + rec.label +
			" (confidence " + u.fmtFixed(rec.confidence * 100, 1) + "%)");
		for (const c of AIIP.data.CLASSES)
			lines.push("  P(" + c.key + ") = " + u.fmtFixed(rec.probs[rec.cls.indexOf(c.key)] * 100, 1) + "%");
		lines.push("windows: " + rec.windows + " (sliding K=" + rec.k + ", step 1)");
		lines.push("");
		lines.push("per-window predictions:");
		rec.perWindow.forEach((w, i) => {
			lines.push("  window " + (i + 1) + ": " + w.label +
				" (" + u.fmtFixed(w.confidence * 100, 1) + "%)");
		});
		lines.push("");
		lines.push("model: threshold engine, K=" + model.k +
			", boundaries low=" + u.fmtFixed(model.boundaries.low, 1) +
			" high=" + u.fmtFixed(model.boundaries.high, 1) + " BPM" +
			", encoding " + model.encoding.min + ".." + model.encoding.max + " BPM");
		if (warnings.length) {
			lines.push("");
			lines.push("warnings:");
			for (const w of warnings)
				lines.push("  - " + w);
		}
		return lines.join("\n") + "\n";
	}

	async function run(ctx, raw, unit)
	{
		const model = ctx.state.model;
		if (!model) {
			showErrors(["train or load a model first"]);
			return;
		}
		if (ctx.state.busy)
			return;

		const bpm = toBpmValues(raw, unit);
		const warnings = [];
		for (const v of bpm) {
			if (v < model.encoding.min || v > model.encoding.max) {
				warnings.push(u.fmtFixed(v, 1) +
					" BPM is outside the training range " +
					model.encoding.min + ".." + model.encoding.max);
				break;
			}
		}
		if (bpm.length < model.k) {
			showErrors(["sequence must have at least K=" + model.k + " values, got " + bpm.length]);
			return;
		}

		ctx.state.busy = true;
		ctx.refresh();

		const wrap = el("recognize-progress-wrap");
		const fill = el("recognize-progress");
		const text = el("recognize-progress-text");
		try {
			wrap.hidden = false;
			setProgress(fill, wrap, text, 25, "predicting\u2026");
			await u.nextFrame();

			const rec = model.predictSeries(bpm);
			rec.k = model.k;
			rec.raw = raw;
			rec.bpm = bpm;
			rec.unit = unit;
			rec.cls = AIIP.data.CLASSES.map((c) => c.key);
			if (rec.confidence < 0.5)
				warnings.push("ambiguous sequence: averaged confidence " +
					u.fmtFixed(rec.confidence * 100, 1) + "%");

			setProgress(fill, wrap, text, 60, "rendering result image\u2026");
			await u.nextFrame();

			ctx.state.recognition = rec;
			el("result-placeholder").hidden = true;
			el("result-canvas").hidden = false;
			AIIP.ecg.render(el("result-canvas"), {
				bpm: rec.bpm,
				k: rec.k,
				probs: rec.probs,
				label: rec.label,
				confidence: rec.confidence,
				windows: rec.windows,
				perWindow: rec.perWindow,
				boundaries: model.boundaries,
			});
			renderResultPanel(rec, unit);
			renderWindowTable(rec);
			showWarnings(warnings);
			setProgress(fill, wrap, text, 100,
				"done: " + rec.label + " \u00b7 " + u.fmtFixed(rec.confidence * 100, 1) + "%");

			logger().success("recognized: " + rec.label +
				" (" + u.fmtFixed(rec.confidence * 100, 1) + "% over " +
				rec.windows + " windows)");
			ctx.setStatus("recognize", "done",
				rec.label + " \u00b7 " + u.fmtFixed(rec.confidence * 100, 1) + "%");
		} catch (e) {
			showErrors(["recognition failed: " + e.message]);
			logger().error("recognition failed: " + e.message);
		} finally {
			ctx.state.busy = false;
			ctx.refresh();
		}
	}

	function runFromInput(ctx)
	{
		const unit = el("unit-select").value;
		const { errors, raw } = parseSequence(el("recognize-input").value, unit);
		if (errors.length) {
			showErrors(errors);
			return;
		}
		if (raw.length === 0) {
			showErrors(["enter at least one value"]);
			return;
		}
		if (raw.length > MAX_VALUES) {
			showErrors(["sequence too long: " + raw.length + " values, max " + MAX_VALUES]);
			return;
		}
		showErrors([]);
		run(ctx, raw, unit);
	}

	function fillAndRun(ctx, values, unit)
	{
		el("unit-select").value = unit;
		el("recognize-input").value = values
			.map((v) => unit === "bpm" ? u.fmtFixed(v, 1) : String(Math.round(v)))
			.join(", ");
		showErrors([]);
		run(ctx, values.slice(), unit);
	}

	function randomExample(ctx)
	{
		const rng = new AIIP.Random(AIIP.randomSeed());
		const c = rng.pick(AIIP.data.CLASSES);
		const d = ctx.state.dataset;
		const r = (d && d.meta && d.meta.ranges && d.meta.ranges[c.key]) ||
			[c.bpmMin, c.bpmMax];
		const values = [];
		for (let i = 0; i < 9; i++)
			values.push(Math.round(rng.float(r[0], r[1]) * 10) / 10);
		fillAndRun(ctx, values, "bpm");
	}

	async function loadFile(ctx, file)
	{
		if (!file || ctx.state.busy)
			return;
		ctx.state.lastFile = file;
		ctx.state.busy = true;
		ctx.refresh();
		let raw = null;
		let unit = "bpm";
		try {
			const text = await file.text();
			const parts = text.split(/[\s,;]+/).filter((p) => p.length > 0);
			const numbers = [];
			const bad = [];
			for (const p of parts) {
				const v = Number(p);
				if (isFinite(v))
					numbers.push(v);
				else
					bad.push(p);
			}
			if (bad.length) {
				showErrors(["not a number: \"" + bad[0] + "\""]);
				logger().error("sequence load failed: " + file.name);
				return;
			}
			if (numbers.length > MAX_VALUES) {
				showErrors(["sequence too long: " + numbers.length + " values, max " + MAX_VALUES]);
				return;
			}
			unit = u.detectUnit(numbers);
			const parsed = parseSequence(text, unit);
			if (parsed.errors.length) {
				showErrors(parsed.errors);
				return;
			}
			if (parsed.raw.length < 3) {
				showErrors(["file contains no sequence: " + file.name]);
				return;
			}
			raw = parsed.raw;
			el("unit-select").value = unit;
			el("recognize-input").value = raw
				.map((v) => unit === "bpm" ? u.fmtFixed(v, 1) : String(Math.round(v)))
				.join(", ");
			showErrors([]);
			logger().info("sequence loaded from " + file.name +
				", detected unit: " + (unit === "bpm" ? "BPM" : "RR ms"));
		} catch (e) {
			showErrors(["sequence load failed: " + e.message]);
			logger().error("sequence load failed: " + e.message);
		} finally {
			ctx.state.busy = false;
			ctx.refresh();
		}
		if (raw)
			await run(ctx, raw, unit);
	}

	function setProgress(fill, wrap, text, pct, label)
	{
		fill.style.width = pct + "%";
		wrap.setAttribute("aria-valuenow", String(Math.round(pct)));
		text.textContent = label;
	}

	function resetResults()
	{
		el("recognize-result").hidden = true;
		el("window-table").hidden = true;
		el("result-canvas").hidden = true;
		el("result-placeholder").hidden = false;
		el("recognize-warnings").hidden = true;
		el("recognize-errors").hidden = true;
		el("recognize-progress-wrap").hidden = true;
	}

	function updateGating(ctx)
	{
		const hasModel = !!ctx.state.model;
		const hasRec = !!ctx.state.recognition;
		const busy = ctx.state.busy;
		el("recognize-run").disabled = !hasModel || busy;
		el("recognize-run-hint").hidden = hasModel && !busy;
		el("recognize-run-hint").textContent = busy
			? "busy \u2014 wait for the current operation"
			: "train or load a model first";
		for (const id of ["example-normal", "example-tachy", "example-brady", "example-random"])
			el(id).disabled = !hasModel || busy;
		el("recognize-file").disabled = busy;
		el("save-png").disabled = !hasRec || busy;
		el("save-jpg").disabled = !hasRec || busy;
		el("save-bmp").disabled = !hasRec || busy;
		el("save-txt").disabled = !hasRec || busy;
		el("save-hint").hidden = hasRec;
	}

	function init(ctx)
	{
		el("recognize-run").addEventListener("click", () => runFromInput(ctx));
		el("recognize-input").addEventListener("keydown", (ev) => {
			if (ev.key === "Enter" && !ev.shiftKey) {
				ev.preventDefault();
				runFromInput(ctx);
			}
		});
		el("example-normal").addEventListener("click", () =>
			fillAndRun(ctx, AIIP.data.exampleByKey("normal").bpm.slice(), "bpm"));
		el("example-tachy").addEventListener("click", () =>
			fillAndRun(ctx, AIIP.data.exampleByKey("tachycardia").bpm.slice(), "bpm"));
		el("example-brady").addEventListener("click", () =>
			fillAndRun(ctx, AIIP.data.exampleByKey("bradycardia").bpm.slice(), "bpm"));
		el("example-random").addEventListener("click", () => randomExample(ctx));
		el("recognize-file").addEventListener("click", () => el("recognize-file-input").click());
		el("recognize-file-input").addEventListener("change", (ev) => {
			loadFile(ctx, ev.target.files[0]);
			ev.target.value = "";
		});

		const save = async (fmt) => {
			const rec = ctx.state.recognition;
			const model = ctx.state.model;
			if (!rec || !model)
				return;
			try {
				const r = await AIIP.imageExport.saveCanvas(el("result-canvas"), fmt, "ecg_result");
				ctx.state.lastSave = r;
				logger().success("image saved: " + r.name + " (" + u.fmtBytes(r.size) + ")");
			} catch (e) {
				logger().error("image save failed (" + fmt + "): " + e.message);
			}
		};
		el("save-png").addEventListener("click", () => save("png"));
		el("save-jpg").addEventListener("click", () => save("jpg"));
		el("save-bmp").addEventListener("click", () => save("bmp"));
		el("save-txt").addEventListener("click", () => {
			const rec = ctx.state.recognition;
			const model = ctx.state.model;
			if (!rec || !model)
				return;
			const warnings = [];
			for (const v of rec.bpm)
				if (v < model.encoding.min || v > model.encoding.max) {
					warnings.push(u.fmtFixed(v, 1) + " BPM outside training range");
					break;
				}
			if (rec.confidence < 0.5)
				warnings.push("ambiguous sequence: confidence " +
					u.fmtFixed(rec.confidence * 100, 1) + "%");
			const name = "ecg_result_" + u.timestamp() + ".txt";
			const text = buildResultText(rec, model, warnings, rec.unit || "bpm");
			const r = AIIP.imageExport.saveText(text, name);
			ctx.state.lastSave = r;
			logger().success("result saved: " + r.name + " (" + u.fmtBytes(r.size) + ")");
		});
	}

	AIIP.recognizeStep = { init, updateGating, resetResults };
})();
