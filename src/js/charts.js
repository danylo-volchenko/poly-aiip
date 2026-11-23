(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const BG = "#101315";
	const GRID = "#293034";
	const AXIS = "#69747c";
	const TEXT = "#aeb6bb";
	const TRAIN = "#7c5cbf";
	const TEST = "#8a9aa5";
	const FONT = "12px system-ui, sans-serif";

	function setup(canvas, fixedHeight)
	{
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const w = Math.max(320, Math.round(rect.width) || 600);
		const h = Math.round(fixedHeight || w * 300 / 900);
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		const ctx = canvas.getContext("2d");
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		return { ctx, w, h };
	}

	function clear(ctx, w, h)
	{
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, w, h);
	}

	function dashed(ctx, x1, y1, x2, y2)
	{
		ctx.save();
		ctx.setLineDash([5, 4]);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
		ctx.restore();
	}

	function frame(ctx, w, h, pad)
	{
		const left = pad.left;
		const bottom = h - pad.bottom;
		const right = w - pad.right;

		ctx.font = FONT;
		ctx.lineWidth = 1;
		ctx.strokeStyle = AXIS;
		ctx.beginPath();
		ctx.moveTo(left, pad.top);
		ctx.lineTo(left, bottom);
		ctx.lineTo(right, bottom);
		ctx.stroke();
		return { left, right, top: pad.top, bottom, w: right - left, h: bottom - pad.top };
	}

	function yTicks(ctx, box, lo, hi, fmt)
	{
		ctx.strokeStyle = GRID;
		ctx.fillStyle = TEXT;
		ctx.textAlign = "right";
		for (let i = 0; i <= 5; i++) {
			const f = i / 5;
			const y = box.top + f * box.h;
			const v = hi - f * (hi - lo);
			ctx.beginPath();
			ctx.moveTo(box.left, y);
			ctx.lineTo(box.right, y);
			ctx.stroke();
			ctx.fillText(fmt(v), box.left - 8, y + 4);
		}
	}

	function drawErrorCurve(canvas, history)
	{
		const { ctx, w, h } = setup(canvas);
		clear(ctx, w, h);
		const errs = history.error;
		if (!errs.length)
			return;

		const pad = { top: 18, right: 20, bottom: 34, left: 64 };
		const box = frame(ctx, w, h, pad);
		const eps = 1e-6;
		const logs = errs.map((e) => Math.log10(e + eps));
		const lo = Math.min(...logs);
		const hi = Math.max(...logs);
		const span = hi - lo || 1;
		yTicks(ctx, box, lo, hi, (v) => u.fmtFixed(Math.pow(10, v), 4));

		ctx.strokeStyle = TRAIN;
		ctx.lineWidth = 2;
		ctx.beginPath();
		logs.forEach((lg, i) => {
			const x = box.left + (errs.length === 1 ? box.w / 2 : box.w * i / (errs.length - 1));
			const y = box.top + (hi - lg) / span * box.h;
			if (i === 0)
				ctx.moveTo(x, y);
			else
				ctx.lineTo(x, y);
		});
		ctx.stroke();

		ctx.fillStyle = TEXT;
		ctx.textAlign = "center";
		ctx.fillText("epoch", box.left + box.w / 2, h - 12);
		ctx.save();
		ctx.translate(14, box.top + box.h / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.fillText("error (log scale)", 0, 0);
		ctx.restore();
	}

	function drawAccuracy(canvas, history)
	{
		const { ctx, w, h } = setup(canvas);
		clear(ctx, w, h);
		const train = history.trainAcc;
		if (!train.length)
			return;

		const pad = { top: 18, right: 20, bottom: 34, left: 64 };
		const box = frame(ctx, w, h, pad);
		let lo = Math.min(...train, ...history.testAcc) - 0.02;
		let hi = Math.max(...train, ...history.testAcc) + 0.02;
		lo = Math.max(0, Math.floor(lo * 20) / 20);
		hi = Math.min(1, Math.ceil(hi * 20) / 20);
		if (hi - lo < 0.05)
			lo = hi - 0.05;
		yTicks(ctx, box, lo, hi, (v) => u.fmtFixed(v, 2));

		const n = train.length;
		const px = (i) => box.left + (n === 1 ? box.w / 2 : box.w * i / (n - 1));
		const py = (v) => box.top + (hi - v) / (hi - lo) * box.h;

		ctx.strokeStyle = TRAIN;
		ctx.lineWidth = 2;
		ctx.beginPath();
		train.forEach((v, i) => {
			if (i === 0)
				ctx.moveTo(px(i), py(v));
			else
				ctx.lineTo(px(i), py(v));
		});
		ctx.stroke();

		if (history.evalEpoch.length) {
			ctx.fillStyle = TEST;
			history.evalEpoch.forEach((e, i) => {
				ctx.beginPath();
				ctx.arc(px(e - 1), py(history.testAcc[i]), 3.5, 0, Math.PI * 2);
				ctx.fill();
			});
		}

		ctx.fillStyle = TRAIN;
		ctx.textAlign = "left";
		ctx.fillText("train", box.left + 8, box.top + 12);
		if (history.evalEpoch.length) {
			ctx.fillStyle = TEST;
			ctx.fillText("test", box.left + 8, box.top + 26);
		}

		ctx.fillStyle = TEXT;
		ctx.textAlign = "center";
		ctx.fillText("epoch", box.left + box.w / 2, h - 12);
		ctx.save();
		ctx.translate(14, box.top + box.h / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.fillText("accuracy", 0, 0);
		ctx.restore();
	}

	function drawScatter(canvas, samples, opts)
	{
		const { ctx, w, h } = setup(canvas);
		clear(ctx, w, h);
		if (!samples.length)
			return;

		const classes = AIIP.data.CLASSES;
		const pad = { top: 18, right: 20, bottom: 40, left: 64 };
		const box = frame(ctx, w, h - 8, pad);

		const means = samples.map((s) => u.mean(s.bpm));
		const sds = samples.map((s) => u.sd(s.bpm));
		let xLo = Math.min(...means);
		let xHi = Math.max(...means);
		if (xHi - xLo < 10) {
			xLo -= 5;
			xHi += 5;
		}
		const yHi = Math.max(5, Math.max(...sds) * 1.2);
		yTicks(ctx, box, 0, yHi, (v) => u.fmtFixed(v, 1));

		const px = (v) => box.left + (v - xLo) / (xHi - xLo) * box.w;
		const py = (v) => box.top + (yHi - v) / yHi * box.h;

		ctx.strokeStyle = GRID;
		ctx.fillStyle = TEXT;
		ctx.textAlign = "center";
		const xTicks = 6;
		for (let i = 0; i <= xTicks; i++) {
			const v = xLo + (xHi - xLo) * i / xTicks;
			const x = px(v);
			ctx.beginPath();
			ctx.moveTo(x, box.top);
			ctx.lineTo(x, box.bottom);
			ctx.stroke();
			ctx.fillText(u.fmtFixed(v, 0), x, box.bottom + 16);
		}

		const lines = (opts && opts.lines) || [];
		for (const line of lines) {
			ctx.strokeStyle = TEXT;
			dashed(ctx, px(line.value), box.top, px(line.value), box.bottom);
			ctx.fillStyle = TEXT;
			ctx.fillText(line.label, px(line.value), box.top - 6);
		}

		ctx.globalAlpha = 0.75;
		samples.forEach((s, i) => {
			const c = classes.find((cl) => cl.key === s.label);
			if (!c)
				return;
			ctx.fillStyle = c.color;
			ctx.beginPath();
			ctx.arc(px(means[i]), py(sds[i]), 3, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.globalAlpha = 1;

		let lx = 4;
		let ly = box.bottom + 28;
		ctx.textAlign = "left";
		for (const c of classes) {
			ctx.fillStyle = c.color;
			ctx.fillRect(lx, ly, 10, 8);
			ctx.fillStyle = TEXT;
			ctx.fillText(c.label, lx + 14, ly + 8);
			lx += 4 + ctx.measureText(c.label).width + 18;
		}

		ctx.fillStyle = TEXT;
		ctx.textAlign = "center";
		ctx.fillText("sequence mean, BPM", box.left + box.w / 2, h - 16);
		ctx.save();
		ctx.translate(14, box.top + box.h / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.fillText("sequence spread, BPM", 0, 0);
		ctx.restore();
	}

	function drawGallery(canvas, samples, k)
	{
		const { ctx, w, h } = setup(canvas);
		clear(ctx, w, h);
		const classes = AIIP.data.CLASSES;
		const rows = 4;
		const gapX = 14;
		const gapY = 10;
		const cellW = (w - gapX * 2 - 16) / classes.length;
		const cellH = (h - gapY * (rows - 1) - 30) / rows;

		ctx.font = FONT;
		classes.forEach((c, col) => {
			const group = samples.filter((s) => s.label === c.key).slice(0, rows);
			const cx = 8 + col * (cellW + gapX);
			ctx.fillStyle = TEXT;
			ctx.textAlign = "left";
			ctx.fillText(`${c.label} (first ${group.length})`, cx, 12);

			for (let row = 0; row < rows; row++) {
				const cy = 20 + row * (cellH + gapY);
				ctx.strokeStyle = GRID;
				ctx.strokeRect(cx, cy, cellW, cellH);
				const s = group[row];
				if (!s)
					continue;
				const bpm = s.bpm.length ? s.bpm : [0];
				const lo = Math.min(...bpm);
				const hi = Math.max(...bpm);
				const span = hi - lo || 1;
				ctx.strokeStyle = c.color;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				bpm.forEach((v, i) => {
					const x = cx + 6 + (cellW - 12) * i / Math.max(1, bpm.length - 1);
					const y = cy + cellH - 6 - (v - lo) / span * (cellH - 12);
					if (i === 0)
						ctx.moveTo(x, y);
					else
						ctx.lineTo(x, y);
				});
				ctx.stroke();
				ctx.fillStyle = TEXT;
				ctx.textAlign = "right";
				ctx.fillText(`mean ${u.fmtFixed(u.mean(bpm), 1)}`, cx + cellW - 4, cy + cellH - 4);
			}
		});
	}

	const BENCH_COLORS = ["#7c5cbf", "#9cc3c2", "#e69f00", "#009e73", "#8a9aa5", "#d28c8c", "#6fb1dc"];

	function fmtParam(v)
	{
		if (!isFinite(v))
			return String(v);
		if (Math.abs(v) >= 1000)
			return u.fmtFixed(v / 1000, v >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k";
		return String(Math.round(v * 100) / 100);
	}

	function fmtLogParam(v)
	{
		if (!isFinite(v) || v <= 0)
			return fmtParam(v);
		return fmtParam(Number(v.toPrecision(2)));
	}

	function fmtTime(v)
	{
		if (!isFinite(v))
			return "\u2014";
		return u.fmtFixed(v, Math.abs(v) >= 1 ? 1 : 3);
	}

	function drawBench(canvas, result)
	{
		const rect = canvas.getBoundingClientRect();
		const cssW = Math.max(320, Math.round(rect.width) || 600);
		const cols = cssW >= 640 ? 2 : 1;
		const cases = result && Array.isArray(result.cases) ? result.cases : [];
		const groups = new Map();
		for (const c of cases) {
			if (!c)
				continue;
			const x = Number(c.param);
			const y = Number(c.mean);
			if (!isFinite(x) || !isFinite(y) || y < 0)
				continue;
			const id = String(c.id || c.title || "case");
			const key = c.scenario || id;
			if (!groups.has(key))
				groups.set(key, { key, label: c.scenarioTitle || c.title || key, unit: c.unit || "", points: [] });
			groups.get(key).points.push({ x, y });
		}

		const series = [];
		let i = 0;
		for (const g of groups.values()) {
			if (!g.points.length)
				continue;
			series.push({
				key: g.key,
				label: String(g.label).replace(/\s+vs\s+.*$/i, ""),
				unit: g.unit,
				color: BENCH_COLORS[i++ % BENCH_COLORS.length],
				points: g.points.slice().sort((a, b) => a.x - b.x),
			});
		}

		if (!series.length) {
			const empty = setup(canvas, 220);
			clear(empty.ctx, empty.w, empty.h);
			empty.ctx.font = FONT;
			empty.ctx.fillStyle = TEXT;
			empty.ctx.textAlign = "center";
			empty.ctx.fillText("No benchmark data yet", empty.w / 2, empty.h / 2);
			return;
		}

		const rows = Math.ceil(series.length / cols);
		const panelH = 158;
		const gapX = 30;
		const gapY = 38;
		const margin = { left: 52, right: 14, top: 8, bottom: 4 };
		const height = margin.top + rows * panelH + (rows - 1) * gapY + margin.bottom;
		const { ctx, w, h } = setup(canvas, height);
		clear(ctx, w, h);

		const panelW = (w - margin.left - margin.right - gapX * (cols - 1)) / cols;
		series.forEach((s, idx) => {
			const col = idx % cols;
			const row = Math.floor(idx / cols);
			const left = margin.left + col * (panelW + gapX);
			const top = margin.top + row * (panelH + gapY);
			const plotTop = top + 24;
			const plotH = 100;
			const plotBottom = plotTop + plotH;
			const box = { left, right: left + panelW, top: plotTop, bottom: plotBottom, w: panelW, h: plotH };

			const xs = s.points.map((p) => p.x);
			const ys = s.points.map((p) => p.y);
			let xLo = Math.min(...xs);
			let xHi = Math.max(...xs);
			if (xHi - xLo < 1e-9) {
				xLo -= 1;
				xHi += 1;
			}
			const yTop = Math.max(...ys) > 0 ? Math.max(...ys) * 1.08 : 1;
			const logX = xLo > 0 && xHi / xLo >= 20;
			const tx = logX ? (v) => Math.log10(v) : (v) => v;
			const xa = tx(xLo);
			const xb = tx(xHi);
			const px = (v) => box.left + (tx(v) - xa) / (xb - xa || 1) * box.w;
			const py = (v) => box.top + (yTop - v) / (yTop || 1) * box.h;

			ctx.fillStyle = s.color;
			ctx.fillRect(left, top + 3, 8, 8);
			ctx.font = "bold 12px system-ui, sans-serif";
			ctx.textAlign = "left";
			ctx.fillText(s.label, left + 14, top + 11);

			ctx.strokeStyle = AXIS;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(box.left, box.top);
			ctx.lineTo(box.left, box.bottom);
			ctx.lineTo(box.right, box.bottom);
			ctx.stroke();

			ctx.font = "10px system-ui, sans-serif";
			ctx.fillStyle = TEXT;
			ctx.textAlign = "right";
			for (let t = 0; t <= 3; t++) {
				const f = t / 3;
				const y = box.top + f * box.h;
				ctx.strokeStyle = GRID;
				ctx.beginPath();
				ctx.moveTo(box.left, y);
				ctx.lineTo(box.right, y);
				ctx.stroke();
				ctx.fillText(fmtTime(yTop * (1 - f)), box.left - 6, y + 3);
			}

			ctx.textAlign = "center";
			const xTicks = 4;
			for (let t = 0; t <= xTicks; t++) {
				const f = t / xTicks;
				const xv = logX ? Math.pow(10, xa + f * (xb - xa)) : xLo + f * (xHi - xLo);
				const x = px(xv);
				ctx.strokeStyle = GRID;
				ctx.beginPath();
				ctx.moveTo(x, box.top);
				ctx.lineTo(x, box.bottom);
				ctx.stroke();
				ctx.fillStyle = TEXT;
				ctx.fillText(logX ? fmtLogParam(xv) : fmtParam(xv), x, box.bottom + 13);
			}

			ctx.strokeStyle = s.color;
			ctx.lineWidth = 2;
			ctx.beginPath();
			s.points.forEach((p, j) => {
				if (j === 0)
					ctx.moveTo(px(p.x), py(p.y));
				else
					ctx.lineTo(px(p.x), py(p.y));
			});
			ctx.stroke();
			ctx.fillStyle = s.color;
			for (const p of s.points) {
				ctx.beginPath();
				ctx.arc(px(p.x), py(p.y), 3, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.fillStyle = TEXT;
			ctx.font = "10px system-ui, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(s.unit || "parameter", box.left + box.w / 2, box.bottom + 29);
		});

		ctx.save();
		ctx.translate(13, margin.top + (rows * panelH + (rows - 1) * gapY) / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.fillStyle = TEXT;
		ctx.font = "11px system-ui, sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("time, ms", 0, 0);
		ctx.restore();
	}

	AIIP.charts = {
		setup,
		drawErrorCurve,
		drawAccuracy,
		drawScatter,
		drawGallery,
		drawBench,
	};
})();
