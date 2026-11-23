(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;
	const logger = () => AIIP.logger;

	let running = false;
	let stopRequested = false;
	let cases = [];
	let lastResult = null;

	function el(id)
	{
		return document.getElementById(id);
	}

	function showErrors(errors)
	{
		const box = el("bench-errors");
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
		logger().error("benchmark form: " + errors[0]);
	}

	function showNotes(notes)
	{
		const box = el("bench-notes");
		if (!notes || !notes.length) {
			box.textContent = "";
			box.hidden = true;
			return;
		}
		box.textContent = "core notes: " + notes.join("; ");
		box.hidden = false;
	}

	function setProgress(pct, label, stopping)
	{
		const fill = el("bench-progress");
		fill.style.width = pct + "%";
		fill.classList.toggle("stopping", !!stopping);
		el("bench-progress-wrap").setAttribute("aria-valuenow", String(Math.round(pct)));
		el("bench-progress-text").textContent = label;
	}

	function progressInfo(p)
	{
		let pct = null;
		let label = "";
		if (typeof p === "number") {
			pct = p <= 1 ? p * 100 : p;
		} else if (p && typeof p === "object") {
			if (isFinite(p.pct))
				pct = p.pct <= 1 ? p.pct * 100 : p.pct;
			else if (isFinite(p.ratio))
				pct = p.ratio * 100;
			else if (isFinite(p.fraction))
				pct = p.fraction * 100;
			else if (isFinite(p.done) && isFinite(p.total) && p.total > 0)
				pct = p.done / p.total * 100;
			else if (isFinite(p.caseIndex) && isFinite(p.caseTotal) && p.caseTotal > 0) {
				const frac = isFinite(p.run) && isFinite(p.runs) && p.runs > 0
					? p.run / p.runs : 0;
				pct = (p.caseIndex + frac) / p.caseTotal * 100;
			}
			label = p.label || p.message || p.text || "";
			if (!label && isFinite(p.done) && isFinite(p.total))
				label = p.done + " / " + p.total;
		}
		if (pct === null)
			pct = 0;
		return { pct: u.clamp(pct, 0, 100), label };
	}

	function parseIntList(raw, label, lo, hi, errors)
	{
		const parts = raw.split(/[\s,;]+/).filter((p) => p.length > 0);
		if (!parts.length) {
			errors.push(label + " must list at least one integer");
			return null;
		}
		const out = [];
		for (const p of parts) {
			if (!/^\d+$/.test(p)) {
				errors.push(label + ": \"" + p + "\" is not a positive integer");
				return null;
			}
			const n = +p;
			if (n < lo || n > hi) {
				errors.push(label + ": " + n + " is outside " + lo + ".." + hi);
				return null;
			}
			out.push(n);
		}
		return out;
	}

	function intValue(id, name, lo, hi, errors)
	{
		const raw = el(id).value.trim();
		if (!/^\d+$/.test(raw)) {
			errors.push(name + " must be an integer in " + lo + ".." + hi);
			return null;
		}
		const n = +raw;
		if (n < lo || n > hi) {
			errors.push(name + " must be an integer in " + lo + ".." + hi);
			return null;
		}
		return n;
	}

	function validate()
	{
		const errors = [];
		const seriesLengths = parseIntList(el("bench-series-lengths").value.trim(),
			"sequence lengths", 100, 1000000, errors);
		const datasetSizes = parseIntList(el("bench-dataset-sizes").value.trim(),
			"dataset sizes", 100, 100000, errors);
		const k = intValue("bench-k", "window K", 2, 64, errors);
		const epochs = intValue("bench-epochs", "training epochs", 1, 500, errors);
		const repeats = intValue("bench-repeats", "runs per case", 1, 20, errors);
		return { errors, config: { seriesLengths, datasetSizes, k, epochs, repeats } };
	}

	function fmtTime(v)
	{
		if (!isFinite(Number(v)))
			return "\u2014";
		return u.fmtFixed(Number(v), 3);
	}

	function fmtParam(c)
	{
		const n = Number(c.param);
		if (!isFinite(n))
			return c.param === undefined || c.param === null ? "\u2014" : String(c.param);
		if (Math.abs(n) >= 1000)
			return n.toLocaleString("en-US");
		return String(n);
	}

	function renderTable(list)
	{
		const box = el("bench-table");
		box.innerHTML = "";
		if (!list.length) {
			box.hidden = true;
			return;
		}
		let nRuns = 0;
		for (const c of list)
			nRuns = Math.max(nRuns, Array.isArray(c.runs) ? c.runs.length : 0);

		const table = document.createElement("table");
		const head = document.createElement("tr");
		const headers = ["case", "parameter"];
		for (let i = 0; i < nRuns; i++)
			headers.push("run " + (i + 1));
		headers.push("min", "mean", "median");
		for (const h of headers) {
			const th = document.createElement("th");
			th.textContent = h;
			head.appendChild(th);
		}
		table.appendChild(head);

		for (const c of list) {
			const tr = document.createElement("tr");
			const runs = Array.isArray(c.runs) ? c.runs : [];
			const cells = [
				c.title || c.id || "case",
				fmtParam(c) + (c.unit ? " " + c.unit : ""),
			];
			for (let i = 0; i < nRuns; i++)
				cells.push(i < runs.length ? fmtTime(runs[i]) : "\u2014");
			cells.push(fmtTime(c.min), fmtTime(c.mean), fmtTime(c.median));
			for (const text of cells) {
				const td = document.createElement("td");
				td.textContent = text;
				tr.appendChild(td);
			}
			table.appendChild(tr);
		}
		box.appendChild(table);
		box.hidden = false;
	}

	function renderChart(result)
	{
		if (!result || !Array.isArray(result.cases) || !result.cases.length)
			return;
		el("bench-chart-placeholder").hidden = true;
		el("bench-chart").hidden = false;
		AIIP.charts.drawBench(el("bench-chart"), result);
	}

	function renderCharts()
	{
		if (lastResult)
			renderChart(lastResult);
	}

	function resetResults()
	{
		el("bench-table").hidden = true;
		el("bench-table").innerHTML = "";
		el("bench-chart").hidden = true;
		el("bench-chart-placeholder").hidden = false;
		showNotes(null);
		setProgress(0, "idle", false);
	}

	function updateGating(ctx)
	{
		const hasModel = !!ctx.state.model;
		const hasBench = !!(AIIP.bench && typeof AIIP.bench.run === "function");
		const busy = ctx.state.busy || running;
		el("bench-run").disabled = !hasModel || !hasBench || busy;
		el("bench-stop").disabled = !running;
		const hint = el("bench-hint");
		if (running)
			hint.textContent = "benchmark running\u2026";
		else if (!hasBench)
			hint.textContent = "benchmark core not loaded (js/bench.js missing)";
		else if (ctx.state.busy)
			hint.textContent = "busy \u2014 wait for the current operation";
		else
			hint.textContent = "train or load a model first";
		hint.hidden = hasModel && hasBench && !ctx.state.busy && !running;
		for (const id of ["bench-series-lengths", "bench-dataset-sizes", "bench-k",
			"bench-epochs", "bench-repeats"])
			el(id).disabled = running;
		el("bench-save-csv").disabled = !lastResult || busy || !hasBench;
		el("bench-save-json").disabled = !lastResult || busy;
	}

	async function startRun(ctx)
	{
		if (running)
			return;
		const { errors, config } = validate();
		if (errors.length) {
			showErrors(errors);
			return;
		}
		if (!ctx.state.model) {
			showErrors(["train or load a model first"]);
			return;
		}
		if (!AIIP.bench || typeof AIIP.bench.run !== "function") {
			showErrors(["benchmark core not available (js/bench.js missing)"]);
			return;
		}
		showErrors([]);

		running = true;
		stopRequested = false;
		cases = [];
		lastResult = null;
		ctx.state.busy = true;
		resetResults();
		ctx.refresh();
		setProgress(0, "starting\u2026", false);
		ctx.setStatus("bench", "ready", "running\u2026");
		logger().info("benchmark started: N=[" + config.seriesLengths.join(", ") +
			"], S=[" + config.datasetSizes.join(", ") + "], K=" + config.k +
			", epochs=" + config.epochs + ", repeats=" + config.repeats);

		try {
			const result = await AIIP.bench.run({
				seriesLengths: config.seriesLengths,
				datasetSizes: config.datasetSizes,
				k: config.k,
				epochs: config.epochs,
				repeats: config.repeats,
				sizes: {
					inference: config.seriesLengths,
					evaluation: config.datasetSizes,
					training: config.datasetSizes,
				},
			}, {
				onCase(c) {
					const item = c && c.case ? c.case : c;
					if (!item)
						return;
					cases.push(item);
					renderTable(cases);
					logger().info("benchmark case: " + (item.title || item.id));
				},
				onProgress(p) {
					const info = progressInfo(p);
					setProgress(info.pct, info.label, stopRequested);
				},
				shouldStop() {
					return stopRequested;
				},
			});

			lastResult = result || {};
			if (!Array.isArray(lastResult.cases) || !lastResult.cases.length)
				lastResult.cases = cases.slice();
			cases = lastResult.cases;
			const coreNotes = lastResult.meta && Array.isArray(lastResult.meta.notes)
				? lastResult.meta.notes : [];
			showNotes(coreNotes);
			renderTable(cases);
			renderChart(lastResult);
			const n = cases.length;
			const stopped = !!(lastResult.meta && lastResult.meta.stopped);
			setProgress(100, n ? "done: " + n + " cases" : "done", false);
			if (stopped) {
				logger().warning("benchmark stopped early: " + n + " cases");
				ctx.setStatus("bench", "done", n + " cases \u00b7 stopped");
			} else {
				logger().success("benchmark finished: " + n + " cases");
				ctx.setStatus("bench", "done", n + " cases \u00b7 " + config.repeats + " runs");
			}
		} catch (e) {
			const msg = e && e.message ? e.message : String(e);
			showErrors(["benchmark failed: " + msg]);
			logger().error("benchmark failed: " + msg);
			ctx.setStatus("bench", "empty", "failed");
		} finally {
			running = false;
			stopRequested = false;
			ctx.state.busy = false;
			el("bench-stop").disabled = true;
			ctx.refresh();
		}
	}

	function saveFile(kind, ctx)
	{
		const result = lastResult;
		if (!result)
			return;
		let text;
		if (kind === "csv") {
			if (!AIIP.bench || typeof AIIP.bench.toCsv !== "function")
				return;
			text = AIIP.bench.toCsv(result);
		} else {
			text = JSON.stringify(result, null, 2) + "\n";
		}
		const name = "ecg_bench_" + u.timestamp() + "." + kind;
		const r = AIIP.imageExport.saveText(text, name);
		ctx.state.lastSave = r;
		logger().success("benchmark " + kind.toUpperCase() + " saved: " +
			r.name + " (" + u.fmtBytes(r.size) + ")");
	}

	function init(ctx)
	{
		el("bench-run").addEventListener("click", () => startRun(ctx));
		el("bench-stop").addEventListener("click", () => {
			if (!running)
				return;
			stopRequested = true;
			el("bench-stop").disabled = true;
			el("bench-progress").classList.add("stopping");
			el("bench-progress-text").textContent = "stopping after current case\u2026";
			logger().info("benchmark stop requested \u2014 finishing current case");
		});
		el("bench-save-csv").addEventListener("click", () => saveFile("csv", ctx));
		el("bench-save-json").addEventListener("click", () => saveFile("json", ctx));
	}

	AIIP.benchStep = { init, updateGating, resetResults, renderCharts };
})();
