"use strict";

module.exports = function (t)
{
	const AI = t.load(["util.js"]);

	t.test("clamp keeps value inside range", () => {
		t.eq(AI.util.clamp(5, 0, 10), 5);
		t.eq(AI.util.clamp(-3, 0, 10), 0);
		t.eq(AI.util.clamp(13, 0, 10), 10);
	});

	t.test("mean averages values", () => {
		t.eq(AI.util.mean([2, 4, 6]), 4);
	});

	t.test("mean of empty array is NaN", () => {
		t.ok(Number.isNaN(AI.util.mean([])), "expected NaN");
	});

	t.test("sd computes population spread", () => {
		t.near(AI.util.sd([2, 4, 6, 8]), Math.sqrt(5), 1e-9);
	});

	t.test("min and max span arrays", () => {
		t.eq(AI.util.min([3, 1, 4, 1, 5]), 1);
		t.eq(AI.util.max([3, 1, 4, 1, 5]), 5);
	});

	t.test("argmax picks first of ties", () => {
		t.eq(AI.util.argmax([1, 5, 5, 2]), 1);
	});

	t.test("bpm and rr ms convert both ways", () => {
		t.near(AI.util.toRR(75), 800, 1e-6);
		t.near(AI.util.toBpm(800), 75, 1e-6);
	});

	t.test("fmtBytes scales units", () => {
		t.eq(AI.util.fmtBytes(512), "512 B");
		t.eq(AI.util.fmtBytes(1536), "1.5 KB");
	});

	t.test("timestamp matches file-name pattern", () => {
		t.ok(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(AI.util.timestamp()), "pattern");
	});

	t.test("fmtFixed trims decimals", () => {
		t.eq(AI.util.fmtFixed(3.14159, 2), "3.14");
		t.eq(AI.util.fmtFixed(2, 0), "2");
	});

	t.test("nextFrame resolves", async () => {
		await AI.util.nextFrame();
	});

	t.test("detectUnit reads bpm-scale means as bpm", () => {
		t.eq(AI.util.detectUnit([72, 68, 75]), "bpm");
		t.eq(AI.util.detectUnit([120, 130, 125]), "bpm");
	});

	t.test("detectUnit reads rr-scale means as rrms", () => {
		t.eq(AI.util.detectUnit([800, 750, 900]), "rrms");
		t.eq(AI.util.detectUnit([250, 260, 240]), "rrms");
	});

	t.test("detectUnit handles empty and boundary", () => {
		t.eq(AI.util.detectUnit([]), "bpm");
		t.eq(AI.util.detectUnit([180, 180, 180]), "bpm");
		t.eq(AI.util.detectUnit([181, 181, 181]), "rrms");
	});
};
