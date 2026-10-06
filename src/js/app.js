(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	function el(id)
	{
		return document.getElementById(id);
	}

	const ctx = {
		state: {
			dataset: null,
			model: null,
			recognition: null,
			lastFile: null,
			lastSave: null,
			busy: false,
		},
		refresh() {
			AIIP.dataStep.updateGating(ctx);
			AIIP.trainStep.updateGating(ctx);
			AIIP.recognizeStep.updateGating(ctx);
		},
		setStatus(key, dot, summary) {
			const badge = el("status-" + key);
			if (!badge)
				return;
			badge.querySelector(".status-dot").dataset.state = dot;
			badge.querySelector(".status-summary").textContent = summary;
		},
	};

	function buildInfo()
	{
		const s = ctx.state;
		const box = el("info-content");
		box.innerHTML = "";

		const section = (title) => {
			const div = document.createElement("div");
			div.className = "modal-section";
			const h = document.createElement("h3");
			h.textContent = title;
			div.appendChild(h);
			box.appendChild(div);
			return div;
		};

		const kv = (div, rows) => {
			const table = document.createElement("table");
			const cells = {};
			for (const [k, v] of rows) {
				const tr = document.createElement("tr");
				const td1 = document.createElement("td");
				td1.textContent = k;
				const td2 = document.createElement("td");
				td2.textContent = v;
				tr.appendChild(td1);
				tr.appendChild(td2);
				table.appendChild(tr);
				cells[k] = td2;
			}
			div.appendChild(table);
			return cells;
		};

		const ds = section("Dataset");
		if (s.dataset) {
			const d = s.dataset;
			kv(ds, [
				["sequences", String(d.samples.length)],
				["split", d.train.length + " / " + d.test.length],
				["window K", String(d.meta.k)],
				["tolerance", d.meta.tol !== undefined ? u.fmtFixed(d.meta.tol, 1) + " BPM" : "\u2014"],
				["seed", d.meta.seed !== undefined ? String(d.meta.seed) : "\u2014 (from file)"],
				["classes", AIIP.data.CLASSES.map((c) => c.label).join(", ")],
			]);
		} else {
			ds.appendChild(document.createTextNode("not generated yet"));
		}

		const ms = section("Model");
		if (s.model) {
			const m = s.model;
			kv(ms, [
				["engine", "threshold (Brain.js in lab 2)"],
				["source", m.source === "file" ? "loaded from file" : "trained"],
				["window K", String(m.k)],
				["boundaries", u.fmtFixed(m.boundaries.low, 1) + " / " + u.fmtFixed(m.boundaries.high, 1) + " BPM"],
				["encoding", m.encoding.min + ".." + m.encoding.max + " BPM"],
				["epochs done", String(m.history.epoch.length || 0)],
				["test accuracy", m.lastEvaluation ? u.fmtFixed(m.lastEvaluation.accuracy * 100, 1) + "%" : "\u2014"],
			]);
		} else {
			ms.appendChild(document.createTextNode("not trained yet"));
		}

		const is = section("Result image");
		const canvas = el("result-canvas");
		if (s.recognition && !canvas.hidden) {
			const cells = kv(is, [
				["resolution", canvas.width + " \u00d7 " + canvas.height + " px"],
				["pixels", String(canvas.width * canvas.height)],
				["PNG size", "\u2026"],
				["JPG size", "\u2026"],
				["BMP size", "\u2026"],
			]);
			AIIP.imageExport.probeSizes(canvas).then((sizes) => {
				cells["PNG size"].textContent = u.fmtBytes(sizes.png);
				cells["JPG size"].textContent = u.fmtBytes(sizes.jpg);
				cells["BMP size"].textContent = u.fmtBytes(sizes.bmp);
			});
		} else {
			is.appendChild(document.createTextNode("no result image yet"));
		}

		const fs = section("Last loaded file");
		if (s.lastFile) {
			const f = s.lastFile;
			const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "\u2014";
			kv(fs, [
				["name", f.name],
				["extension", ext],
				["size", u.fmtBytes(f.size)],
				["MIME type", f.type || "\u2014"],
				["modified", f.lastModified ? new Date(f.lastModified).toLocaleString() : "\u2014"],
			]);
		} else {
			fs.appendChild(document.createTextNode("no file loaded yet"));
		}

		const ss = section("Last saved file");
		if (s.lastSave)
			kv(ss, [["name", s.lastSave.name], ["size", u.fmtBytes(s.lastSave.size)]]);
		else
			ss.appendChild(document.createTextNode("no file saved yet"));

		const es = section("Environment");
		kv(es, [
			["model engine", "threshold sweep (Brain.js integration lands in lab 2)"],
			["brain.js", "not integrated yet"],
			["browser", navigator.userAgent.slice(0, 90) + "\u2026"],
			["language", navigator.language],
		]);
	}

	function openModal(modal)
	{
		modal.hidden = false;
		const close = modal.querySelector(".icon-button");
		if (close)
			close.focus();
	}

	function closeModal(modal)
	{
		modal.hidden = true;
	}

	function initModals()
	{
		const info = el("info-modal");
		const help = el("help-modal");
		el("info-button").addEventListener("click", () => {
			buildInfo();
			openModal(info);
		});
		el("info-close").addEventListener("click", () => closeModal(info));
		el("help-button").addEventListener("click", () => openModal(help));
		el("help-close").addEventListener("click", () => closeModal(help));
		for (const m of [info, help]) {
			m.addEventListener("click", (ev) => {
				if (ev.target === m)
					closeModal(m);
			});
		}
		document.addEventListener("keydown", (ev) => {
			if (ev.key === "Escape") {
				closeModal(info);
				closeModal(help);
			}
		});
	}

	function initStatus()
	{
		const cards = {
			data: el("data-card"),
			model: el("train-card"),
			recognize: el("recognize-card"),
		};
		for (const key of Object.keys(cards)) {
			el("status-" + key).addEventListener("click", () => {
				cards[key].scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	}

	function initLog()
	{
		AIIP.logger.init({ list: el("log-list"), count: el("log-count") });
		el("log-save-button").addEventListener("click", () => {
			const lines = AIIP.logger.entries().map((e) =>
				new Date(e.time).toLocaleTimeString("en-GB", { hour12: false }) +
				"." + String(e.time % 1000).padStart(3, "0") +
				" [" + e.level.toUpperCase() + "] " + e.message);
			const name = "ecg_log_" + u.timestamp() + ".txt";
			const r = AIIP.imageExport.saveText(lines.join("\n") + "\n", name);
			ctx.state.lastSave = r;
			AIIP.logger.success("log saved: " + r.name + " (" + u.fmtBytes(r.size) + ")");
		});
		el("log-clear-button").addEventListener("click", () => {
			if (confirm("Clear the operations log?"))
				AIIP.logger.clear();
		});
	}

	function initResize()
	{
		let timer = null;
		window.addEventListener("resize", () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				const s = ctx.state;
				if (s.dataset) {
					AIIP.dataStep.renderCharts(s);
				}
				if (s.model) {
					AIIP.trainStep.renderCharts(s.model);
				}
				if (s.recognition && s.model) {
					const m = s.model;
					AIIP.ecg.render(el("result-canvas"), {
						bpm: s.recognition.bpm,
						k: s.recognition.k,
						probs: s.recognition.probs,
						label: s.recognition.label,
						confidence: s.recognition.confidence,
						windows: s.recognition.windows,
						perWindow: s.recognition.perWindow,
						boundaries: m.boundaries,
					});
				}
			}, 150);
		});
	}

	function selfSmoke()
	{
		const mark = (msg) => {
			let d = document.getElementById("app-smoke-result");
			if (!d) {
				d = document.createElement("div");
				d.id = "app-smoke-result";
				document.body.appendChild(d);
			}
			d.textContent = msg;
		};
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

		async function drive()
		{
			let tries = 0;
			document.getElementById("data-generate").click();
			while ((!ctx.state.dataset || ctx.state.busy) && tries++ < 400)
				await sleep(50);
			if (!ctx.state.dataset)
				throw new Error("no dataset after generate");

			document.getElementById("train-epochs").value = "50";
			document.getElementById("train-start").click();
			tries = 0;
			while ((!ctx.state.model || ctx.state.busy) && tries++ < 1200)
				await sleep(50);
			if (!ctx.state.model || !ctx.state.model.lastEvaluation)
				throw new Error("no model after train");

			const chips = [
				["example-normal", "normal"],
				["example-tachy", "tachycardia"],
				["example-brady", "bradycardia"],
			];
			const results = [];
			for (const [id, label] of chips) {
				const chip = document.getElementById(id);
				if (chip.disabled)
					throw new Error(id + " disabled with model present");
				chip.click();
				tries = 0;
				while ((!ctx.state.recognition || ctx.state.busy) && tries++ < 400)
					await sleep(50);
				if (!ctx.state.recognition)
					throw new Error(id + ": no recognition");
				if (ctx.state.recognition.label !== label)
					throw new Error(id + ": expected " + label +
						", got " + ctx.state.recognition.label);
				results.push(label + " " +
					(ctx.state.recognition.confidence * 100).toFixed(1) + "%");
				ctx.state.recognition = null;
			}
			for (const box of ["data-errors", "train-errors", "recognize-errors"]) {
				if (!document.getElementById(box).hidden)
					throw new Error(box + " visible after clean run");
			}
			mark("APP-SMOKE: PASS - generate, train 50, chips: " + results.join(", "));
		}

		drive().catch((e) => {
			mark("APP-SMOKE: FAIL - " + (e && e.message ? e.message : e));
		});
	}

	function init()
	{
		initLog();
		AIIP.dataStep.init(ctx);
		AIIP.trainStep.init(ctx);
		AIIP.recognizeStep.init(ctx);
		initStatus();
		initModals();
		initResize();
		ctx.refresh();
		AIIP.logger.info("AIIP ready \u2014 generate a dataset to start (step 1)");
		AIIP.logger.info("engine: threshold sweep; Brain.js integration lands in lab 2");
		if (new URLSearchParams(location.search).get("appsmoke") === "1")
			selfSmoke();
	}

	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", init);
	else
		init();

	AIIP.app = { ctx };
})();
