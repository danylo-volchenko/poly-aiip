(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};

	function clamp(v, lo, hi)
	{
		return v < lo ? lo : v > hi ? hi : v;
	}

	function mean(arr)
	{
		if (!arr.length)
			return NaN;
		let s = 0;
		for (const v of arr)
			s += v;
		return s / arr.length;
	}

	function sd(arr)
	{
		if (!arr.length)
			return NaN;
		const m = mean(arr);
		let s = 0;
		for (const v of arr)
			s += (v - m) * (v - m);
		return Math.sqrt(s / arr.length);
	}

	function min(arr)
	{
		let m = Infinity;
		for (const v of arr)
			if (v < m)
				m = v;
		return m;
	}

	function max(arr)
	{
		let m = -Infinity;
		for (const v of arr)
			if (v > m)
				m = v;
		return m;
	}

	function argmax(arr)
	{
		let best = 0;
		for (let i = 1; i < arr.length; i++)
			if (arr[i] > arr[best])
				best = i;
		return best;
	}

	const MS_PER_MINUTE = 60000;

	function toRR(bpm)
	{
		return MS_PER_MINUTE / bpm;
	}

	function toBpm(rrMs)
	{
		return MS_PER_MINUTE / rrMs;
	}

	function fmtFixed(v, digits)
	{
		return Number(v).toFixed(digits);
	}

	function fmtBytes(n)
	{
		if (n < 1024)
			return `${n} B`;
		if (n < 1024 * 1024)
			return `${fmtFixed(n / 1024, 1)} KB`;
		return `${fmtFixed(n / (1024 * 1024), 1)} MB`;
	}

	function pad2(n)
	{
		return String(n).padStart(2, "0");
	}

	function timestamp()
	{
		const d = new Date();
		return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
			"_" + pad2(d.getHours()) + "-" + pad2(d.getMinutes()) + "-" + pad2(d.getSeconds());
	}

	function nextFrame()
	{
		return new Promise((resolve) => {
			let done = false;
			const finish = () => {
				if (!done) {
					done = true;
					resolve();
				}
			};
			if (typeof requestAnimationFrame === "function")
				requestAnimationFrame(finish);
			setTimeout(finish, 32);
		});
	}

	function detectUnit(values)
	{
		if (!values.length)
			return "bpm";
		return mean(values) > 180 ? "rrms" : "bpm";
	}

	AIIP.util = {
		clamp,
		mean,
		sd,
		min,
		max,
		argmax,
		toRR,
		toBpm,
		fmtFixed,
		fmtBytes,
		timestamp,
		nextFrame,
		detectUnit,
	};
})();
