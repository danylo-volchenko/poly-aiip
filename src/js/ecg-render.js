(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const W = 1400;
	const H = 800;
	const BG = "#101315";
	const PAPER = "#fffafd";
	const INK = "#1d2b30";
	const MINOR = "#f2c3d4";
	const MAJOR = "#e58fb1";
	const BAND = "#d9f2ee";
	const FONT = "15px system-ui, sans-serif";
	const SMALL = "13px system-ui, sans-serif";

	function classColor(key)
	{
		const c = AIIP.data.CLASSES.find((cl) => cl.key === key);
		return c ? c.color : "#8a9aa5";
	}

	function rrMs(bpm)
	{
		return 60000 / bpm;
	}

	function drawBeat(ctx, x, base, pxMs)
	{
		const bump = (cx, h, wMs, dir) => {
			ctx.quadraticCurveTo(
				x + (cx - wMs / 2) * pxMs, base + dir * h / 2,
				x + cx * pxMs, base + dir * h);
			ctx.quadraticCurveTo(
				x + (cx + wMs / 2) * pxMs, base + dir * h / 2,
				x + (cx + wMs) * pxMs, base);
		};

		ctx.beginPath();
		ctx.moveTo(x - 260 * pxMs, base);
		bump(-150, 9, 40, -1);
		ctx.lineTo(x - 40 * pxMs, base);
		ctx.lineTo(x - 22 * pxMs, base + 7);
		ctx.lineTo(x, base - 105);
		ctx.lineTo(x + 22 * pxMs, base + 12);
		ctx.lineTo(x + 45 * pxMs, base);
		bump(150, 14, 55, -1);
		ctx.lineTo(x + 300 * pxMs, base);
		ctx.strokeStyle = INK;
		ctx.lineWidth = 2;
		ctx.stroke();
	}

	function drawStripGrid(ctx, box, pxMs)
	{
		ctx.fillStyle = PAPER;
		ctx.fillRect(box.x, box.y, box.w, box.h);

		const yStep = 15;
		ctx.lineWidth = 1;
		for (let y = box.y; y <= box.y + box.h; y += yStep) {
			ctx.strokeStyle = MINOR;
			ctx.beginPath();
			ctx.moveTo(box.x, y);
			ctx.lineTo(box.x + box.w, y);
			ctx.stroke();
		}

		const totalMs = box.w / pxMs;
		for (let t = 0; t <= totalMs; t += 40) {
			const x = box.x + t * pxMs;
			ctx.strokeStyle = t % 200 === 0 ? MAJOR : MINOR;
			ctx.beginPath();
			ctx.moveTo(x, box.y);
			ctx.lineTo(x, box.y + box.h);
			ctx.stroke();
		}
	}

	function render(canvas, data)
	{
		canvas.width = W;
		canvas.height = H;
		const ctx = canvas.getContext("2d");

		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, W, H);
		ctx.font = FONT;

		const bpm = data.bpm;
		const n = bpm.length;
		const rrs = bpm.map(rrMs);
		const times = [0];
		for (let i = 0; i < n; i++)
			times.push(times[i] + rrs[i]);
		const totalMs = times[n];

		const strip = { x: 40, y: 110, w: W - 70, h: 330 };
		const padRight = 60;
		const pxMs = (strip.w - padRight) / totalMs;
		const base = strip.y + strip.h * 0.62;

		drawStripGrid(ctx, strip, pxMs);

		const beatX = (i) => strip.x + times[i] * pxMs + rrs[i] * pxMs * 0.5;

		for (let i = 0; i < n; i++)
			drawBeat(ctx, beatX(i), base, pxMs);

		ctx.fillStyle = INK;
		ctx.font = SMALL;
		ctx.textAlign = "center";
		for (let i = 0; i < n; i++) {
			ctx.fillText(String(i + 1), beatX(i), base - 112);
			if (i > 0 && pxMs * (times[i] - times[i - 1]) > 90)
				ctx.fillText(
					`${u.fmtFixed(rrs[i], 0)} ms · ${u.fmtFixed(bpm[i], 1)} BPM`,
					(beatX(i) + beatX(i - 1)) / 2,
					strip.y + strip.h - 8);
		}

		ctx.strokeStyle = MAJOR;
		ctx.lineWidth = 2;
		ctx.strokeRect(strip.x, strip.y, strip.w, strip.h);
		ctx.fillStyle = MINOR === MINOR ? "#e58fb1" : "#e58fb1";
		ctx.font = FONT;
		ctx.textAlign = "left";
		ctx.fillText("ECG strip — synthesized R spikes at given rates", strip.x, strip.y - 10);

		const hist = { x: strip.x, y: 520, w: strip.w, h: 230 };
		ctx.fillStyle = BG;
		ctx.fillRect(hist.x, hist.y, hist.w, hist.h);

		const rrMax = Math.max(Math.max(...rrs) * 1.15, 1100);
		const bandTop = hist.y + (1 - 1000 / rrMax) * hist.h;
		const bandBot = hist.y + (1 - 600 / rrMax) * hist.h;
		ctx.fillStyle = BAND;
		ctx.globalAlpha = 0.35;
		ctx.fillRect(hist.x, bandTop, hist.w, bandBot - bandTop);
		ctx.globalAlpha = 1;

		const py = (v) => hist.y + (1 - v / rrMax) * hist.h;
		ctx.strokeStyle = "#8a9aa5";
		ctx.setLineDash([6, 5]);
		for (const [v, label] of [[1000, "60000/60 = 1000 ms · 60 BPM"], [600, "60000/100 = 600 ms · 100 BPM"]]) {
			ctx.beginPath();
			ctx.moveTo(hist.x, py(v));
			ctx.lineTo(hist.x + hist.w, py(v));
			ctx.stroke();
			ctx.fillStyle = "#aeb6bb";
			ctx.textAlign = "right";
			ctx.font = SMALL;
			ctx.fillText(label, hist.x + hist.w, py(v) - 5);
		}
		ctx.setLineDash([]);

		const barW = Math.min(46, Math.max(8, pxMs * 90));
		for (let i = 0; i < n; i++) {
			const win = Math.min(i, data.perWindow.length - 1);
			const pred = data.perWindow[win] ? data.perWindow[win].label : data.label;
			ctx.fillStyle = classColor(pred);
			const x = beatX(i) - barW / 2;
			const yTop = py(rrs[i]);
			ctx.fillRect(x, yTop, barW, hist.y + hist.h - yTop);
			ctx.strokeStyle = BG;
			ctx.strokeRect(x, yTop, barW, hist.y + hist.h - yTop);
		}

		ctx.strokeStyle = "#69747c";
		ctx.lineWidth = 1;
		ctx.strokeRect(hist.x, hist.y, hist.w, hist.h);
		ctx.fillStyle = "#aeb6bb";
		ctx.font = FONT;
		ctx.textAlign = "left";
		ctx.fillText("RR interval histogram — bar height = interval, bar color = predicted class", strip.x, hist.y - 10);
		ctx.save();
		ctx.translate(hist.x - 10, hist.y + hist.h / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.textAlign = "center";
		ctx.fillText("RR, ms", 0, 0);
		ctx.restore();
		for (let v = 0; v <= rrMax; v += 200) {
			ctx.fillStyle = "#aeb6bb";
			ctx.textAlign = "right";
			ctx.font = SMALL;
			ctx.fillText(String(v), hist.x - 8, py(v) + 4);
			ctx.strokeStyle = "#293034";
			ctx.beginPath();
			ctx.moveTo(hist.x, py(v));
			ctx.lineTo(hist.x + 6, py(v));
			ctx.stroke();
		}

		const cls = AIIP.data.CLASSES;
		const probs = data.probs;
		ctx.font = FONT;
		ctx.textAlign = "left";
		ctx.fillStyle = classColor(data.label);
		ctx.font = "bold 26px system-ui, sans-serif";
		ctx.fillText(`Prediction: ${data.label}  ·  confidence ${u.fmtFixed(data.confidence * 100, 1)}%`, 40, 56);
		ctx.font = FONT;
		ctx.fillStyle = "#aeb6bb";
		let px = 40;
		cls.forEach((c, i) => {
			ctx.fillStyle = c.color;
			ctx.fillRect(px, 70, 12, 12);
			ctx.fillStyle = "#aeb6bb";
			ctx.textAlign = "left";
			const text = `${c.label} ${u.fmtFixed(probs[i] * 100, 1)}%`;
			ctx.fillText(text, px + 18, 81);
			px += 18 + ctx.measureText(text).width + 24;
		});
		ctx.fillStyle = "#aeb6bb";
		ctx.textAlign = "right";
		ctx.fillText(`k=${data.k} · windows=${data.windows} · boundaries ${u.fmtFixed(data.boundaries.low, 1)}/${u.fmtFixed(data.boundaries.high, 1)} BPM`, W - 40, 56);
	}

	AIIP.ecg = { render, W, H };
})();
