(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;
	const logger = () => AIIP.logger;

	function el(id)
	{
		return document.getElementById(id);
	}

	let stopRequested = false;
	let training = false;

	function setProgress(pct, label, stopping)
	{
		const fill = el("train-progress");
		fill.style.width = pct + "%";
		fill.classList.toggle("stopping", !!stopping);
		el("train-progress-wrap").setAttribute("aria-valuenow", String(Math.round(pct)));
		el("train-progress-text").textContent = label;
	}

	function showErrors(errors)
	{
		const box = el("train-errors");
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
		logger().error("train form: " + errors[0]);
	}

	function validate()
	{
		const errors = [];
		const epochs = el("train-epochs").value.trim();
		if (!/^\d+$/.test(epochs) || +epochs < 1 || +epochs > 20000)
			errors.push("epochs must be an integer in 1..20000");
		const thresh = el("train-error-thresh").value.trim();
		if (thresh !== "" && (!isFinite(+thresh) || +thresh < 0 || +thresh > 0.5))
			errors.push("early stop error must be a number in 0..0.5 or blank");
		return errors;
	}

	function renderSummary(model, ev)
	{
		const box = el("model-summary");
		box.innerHTML = "";
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
			box.appendChild(t);
		};
		add("engine", "threshold", model.source === "file" ? "loaded from file" : "sweep trained");
		add("boundaries", u.fmtFixed(model.boundaries.low, 1) + " / " +
			u.fmtFixed(model.boundaries.high, 1), "low / high, BPM");
		add("window K", String(model.k));
		add("epochs done", String(model.history.epoch.length || 0));
		const lastTrainAcc = model.history.trainAcc.length
			? model.history.trainAcc[model.history.trainAcc.length - 1]
			: null;
		add("train acc", lastTrainAcc !== null
			? u.fmtFixed(lastTrainAcc * 100, 1) + "%" : "\u2014",
			model.trainSize + " samples");
		add("test acc", ev ? u.fmtFixed(ev.accuracy * 100, 1) + "%" : "\u2014",
			model.testSize ? model.testSize + " samples" : "\u2014");
		box.hidden = false;
	}

	function renderConfusion(ev)
	{
		const keys = AIIP.data.CLASSES.map((c) => c.key);
		const box = el("confusion-table");
		box.innerHTML = "";
		const table = document.createElement("table");
		const head = document.createElement("tr");
		head.appendChild(document.createElement("th"));
		for (const k of keys) {
			const th = document.createElement("th");
			th.textContent = "pred " + k;
			head.appendChild(th);
		}
		table.appendChild(head);
		keys.forEach((k, i) => {
			const tr = document.createElement("tr");
			const th = document.createElement("th");
			th.textContent = "true " + k;
			tr.appendChild(th);
			ev.confusion[i].forEach((n, j) => {
				const td = document.createElement("td");
				td.textContent = String(n);
				if (i === j && n > 0)
					td.className = "diag";
				tr.appendChild(td);
			});
			table.appendChild(tr);
		});
		box.appendChild(table);
		box.hidden = false;
	}

	function renderMetrics(ev)
	{
		const list = el("metrics-list");
		list.innerHTML = "";
		const row = (text) => {
			const li = document.createElement("li");
			li.textContent = text;
			list.appendChild(li);
		};
		row("accuracy: " + u.fmtFixed(ev.accuracy * 100, 2) + "%");
		row("macro F1: " + u.fmtFixed(ev.macroF1, 3));
		row("cross-entropy: " + u.fmtFixed(ev.crossEntropy, 4));
		for (const c of ev.perClass) {
			row(c.key + ": P " + u.fmtFixed(c.precision, 2) +
				" \u00b7 R " + u.fmtFixed(c.recall, 2) +
				" \u00b7 F1 " + u.fmtFixed(c.f1, 2) +
				" \u00b7 n " + c.support);
		}
		list.hidden = false;

		const mis = el("misclassified-list");
		mis.innerHTML = "";
		for (const m of ev.misclassified.slice(0, 20)) {
			const li = document.createElement("li");
			li.textContent = "true " + m.label + " \u2192 pred " + m.predicted +
				" (mean " + u.fmtFixed(m.mean, 1) + " BPM): " +
				m.bpm.map((v) => u.fmtFixed(v, 1)).join(", ");
			mis.appendChild(li);
		}
		mis.hidden = ev.misclassified.length === 0;
	}

	function renderCharts(model)
	{
		if (!model.history.epoch.length)
			return;
		AIIP.charts.drawErrorCurve(el("error-canvas"), model.history);
		AIIP.charts.drawAccuracy(el("acc-canvas"), model.history);
		el("error-curve-placeholder").hidden = true;
		el("error-canvas").hidden = false;
		el("acc-canvas").hidden = false;
	}

	function updateGating(ctx)
	{
		const hasData = !!ctx.state.dataset;
		const hasModel = !!ctx.state.model;
		const busy = ctx.state.busy;
		el("train-start").disabled = !hasData || busy;
		el("train-start-hint").hidden = hasData && !busy;
		el("train-start-hint").textContent = busy
			? "busy \u2014 wait for the current operation"
			: "generate a dataset first";
		el("model-save").disabled = !hasModel || busy;
		el("model-load").disabled = busy;
	}

	function resetResults()
	{
		el("model-summary").hidden = true;
		el("confusion-table").hidden = true;
		el("metrics-list").hidden = true;
		el("misclassified-list").hidden = true;
		el("error-curve-placeholder").hidden = false;
		el("error-canvas").hidden = true;
		el("acc-canvas").hidden = true;
		setProgress(0, "idle", false);
	}

	async function startTraining(ctx)
	{
		if (training)
			return;
		const errors = validate();
		if (errors.length) {
			showErrors(errors);
			return;
		}
		showErrors([]);
		const d = ctx.state.dataset;
		if (!d || !d.train.length) {
			showErrors(["generate or load a dataset first"]);
			return;
		}

		const epochs = +el("train-epochs").value;
		const threshRaw = el("train-error-thresh").value.trim();
		const errorThresh = threshRaw === "" ? 0 : +threshRaw;

		const encoding = AIIP.RhythmModel.encodingFor(d.samples);
		const model = new AIIP.RhythmModel({ k: d.meta.k, encoding });
		const evalEvery = Math.max(1, Math.round(epochs / 100));

		training = true;
		stopRequested = false;
		ctx.state.busy = true;
		ctx.state.model = null;
		ctx.state.recognition = null;
		resetResults();
		if (AIIP.recognizeStep)
			AIIP.recognizeStep.resetResults();
		ctx.refresh();
		el("train-stop").disabled = false;
		setProgress(0, "epoch 0/" + epochs, false);
		const t0 = performance.now();

		try {
			await model.train(d.train, d.test, { epochs, errorThresh }, {
				onEpoch(h) {
					setProgress(h.epoch / epochs * 100,
						"epoch " + h.epoch + "/" + epochs +
						" \u00b7 error " + u.fmtFixed(h.error, 4) +
						" \u00b7 train " + u.fmtFixed(h.trainAcc * 100, 1) + "%",
						stopRequested);
					if (h.epoch % evalEvery === 0 || h.epoch === epochs)
						renderCharts(model);
				},
				shouldStop() {
					return stopRequested;
				},
			});

			const ms = Math.round(performance.now() - t0);
			setProgress(100, "evaluating on " + d.test.length + " test sequences\u2026", false);
			const ev = await model.evaluate(d.test, {
				onProgress(done, total) {
					setProgress(done / total * 100,
						"evaluating " + done + "/" + total, false);
				},
			});
			model.lastEvaluation = ev;

			const last = model.history.epoch.length;
			setProgress(100, "done in " + ms + " ms \u00b7 " +
				u.fmtFixed(ev.accuracy * 100, 1) + "% test accuracy", false);

			ctx.state.model = model;
			ctx.state.busy = false;
			training = false;
			el("train-stop").disabled = true;

			renderSummary(model, ev);
			renderConfusion(ev);
			renderMetrics(ev);
			renderCharts(model);
			logger().success("model trained: " + last + " epochs in " + ms +
				" ms, test accuracy " + u.fmtFixed(ev.accuracy * 100, 1) + "%");
			ctx.setStatus("model", "done",
				"threshold \u00b7 " + u.fmtFixed(model.boundaries.low, 0) + "/" +
				u.fmtFixed(model.boundaries.high, 0) + " BPM \u00b7 " +
				u.fmtFixed(ev.accuracy * 100, 1) + "%");
			ctx.setStatus("recognize", "ready", "ready");
		} catch (e) {
			showErrors(["training failed: " + e.message]);
			logger().error("training failed: " + e.message);
		} finally {
			if (training) {
				training = false;
				ctx.state.busy = false;
				el("train-stop").disabled = true;
			}
			ctx.refresh();
		}
	}

	async function loadModel(ctx, file)
	{
		if (!file)
			return;
		ctx.state.lastFile = file;
		ctx.state.busy = true;
		ctx.refresh();
		try {
			const text = await file.text();
			let model;
			try {
				const obj = JSON.parse(text);
				model = AIIP.RhythmModel.fromJSON(obj);
			} catch (e) {
				showErrors(["model load failed: " + e.message]);
				logger().error("model load failed: " + e.message);
				return;
			}
			const d = ctx.state.dataset;
			if (d && d.meta.k !== model.k) {
				showErrors(["model K=" + model.k + " does not match dataset K=" + d.meta.k]);
				logger().error("model K=" + model.k + " does not match dataset K=" + d.meta.k);
				return;
			}
			showErrors([]);

			let ev = model.lastEvaluation || null;
			if (!ev && model.history.epoch.length && d && d.test.length &&
				d.meta.k === model.k) {
				setProgress(100, "evaluating on " + d.test.length + " test sequences\u2026", false);
				ev = await model.evaluate(d.test, {
					onProgress(done, total) {
						setProgress(done / total * 100,
							"evaluating " + done + "/" + total, false);
					},
				});
				model.lastEvaluation = ev;
			}

			ctx.state.model = model;
			ctx.state.recognition = null;
			if (AIIP.recognizeStep)
				AIIP.recognizeStep.resetResults();
			renderSummary(model, ev);
			if (ev) {
				renderConfusion(ev);
				renderMetrics(ev);
			}
			renderCharts(model);
			logger().success("model loaded: K=" + model.k +
				", boundaries " + u.fmtFixed(model.boundaries.low, 1) +
				"/" + u.fmtFixed(model.boundaries.high, 1));
			ctx.setStatus("model", "done",
				"threshold \u00b7 " + u.fmtFixed(model.boundaries.low, 0) + "/" +
				u.fmtFixed(model.boundaries.high, 0) + " BPM \u00b7 file");
			ctx.setStatus("recognize", "ready", "ready");
		} catch (e) {
			showErrors(["model load failed: " + e.message]);
			logger().error("model load failed: " + e.message);
		} finally {
			ctx.state.busy = false;
			ctx.refresh();
		}
	}

	function init(ctx)
	{
		el("train-start").addEventListener("click", () => startTraining(ctx));
		el("train-stop").addEventListener("click", () => {
			if (!training)
				return;
			stopRequested = true;
			el("train-stop").disabled = true;
			el("train-progress").classList.add("stopping");
			el("train-progress-text").textContent = "stopping after current epoch\u2026";
			logger().info("stop requested \u2014 finishing current epoch");
		});
		el("model-load").addEventListener("click", () => el("model-file-input").click());
		el("model-file-input").addEventListener("change", (ev) => {
			loadModel(ctx, ev.target.files[0]);
			ev.target.value = "";
		});
		el("model-save").addEventListener("click", () => {
			const model = ctx.state.model;
			if (!model)
				return;
			const name = "ecg_model_K" + model.k + "-thr_" + u.timestamp() + ".json";
			const r = AIIP.imageExport.saveText(JSON.stringify(model.toJSON(), null, 2), name);
			ctx.state.lastSave = r;
			logger().success("model saved: " + r.name + " (" + u.fmtBytes(r.size) + ")");
		});
	}

	AIIP.trainStep = { init, updateGating, renderCharts, resetResults };
})();
