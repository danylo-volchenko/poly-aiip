"use strict";

module.exports = function (t)
{
	const AI = t.load(["util.js", "rng.js", "generator.js"]);

	t.test("classes cover variant 6 rhythms", () => {
		const keys = AI.data.CLASSES.map((c) => c.key).sort();
		t.eq(keys, ["bradycardia", "normal", "tachycardia"]);
		t.eq(AI.data.classByKey("normal").bpmMin, 60);
		t.eq(AI.data.classByKey("normal").bpmMax, 100);
	});

	t.test("generate produces per-class count with k values", () => {
		const ds = AI.data.generateDataset({ perClass: 10, k: 4, tol: 4, seed: 42 });
		t.eq(ds.samples.length, 30);
		for (const s of ds.samples) {
			t.eq(s.bpm.length, 4);
			t.ok(AI.data.CLASSES.some((c) => c.key === s.label), `bad label ${s.label}`);
		}
	});

	t.test("same seed reproduces dataset", () => {
		const a = AI.data.generateDataset({ perClass: 5, k: 4, tol: 4, seed: 7 });
		const b = AI.data.generateDataset({ perClass: 5, k: 4, tol: 4, seed: 7 });
		t.eq(a, b);
	});

	t.test("values stay inside class range widened by tol", () => {
		const ds = AI.data.generateDataset({ perClass: 200, k: 4, tol: 4, seed: 3 });
		for (const s of ds.samples) {
			const c = AI.data.classByKey(s.label);
			for (const v of s.bpm)
				t.ok(v >= c.bpmMin - 4.0001 && v <= c.bpmMax, `${s.label} out of range: ${v}`);
		}
	});

	t.test("split is stratified", () => {
		const ds = AI.data.generateDataset({ perClass: 10, k: 4, tol: 4, seed: 5 });
		const rng = new AI.Random(1);
		const split = AI.data.splitSamples(ds.samples, 20, rng);
		t.eq(split.train.length + split.test.length, 30);
		for (const c of AI.data.CLASSES) {
			const trainC = split.train.filter((s) => s.label === c.key).length;
			const testC = split.test.filter((s) => s.label === c.key).length;
			t.eq(trainC + testC, 10);
			t.eq(testC, 2);
		}
	});

	t.test("summarize counts all classes", () => {
		const ds = AI.data.generateDataset({ perClass: 10, k: 4, tol: 4, seed: 9 });
		const sum = AI.data.summarize(ds.samples);
		t.eq(sum.map((s) => s.key).sort(), ["bradycardia", "normal", "tachycardia"]);
		t.eq(sum.map((s) => s.count), [10, 10, 10]);
	});

	t.test("csv round trip", () => {
		const ds = AI.data.generateDataset({ perClass: 4, k: 4, tol: 4, seed: 11 });
		const text = AI.data.datasetToCsvText(ds);
		const back = AI.data.parseDatasetCsv(text);
		t.eq(back.errors, []);
		t.eq(back.samples, ds.samples);
	});

	t.test("csv errors carry line numbers", () => {
		const text = "normal,70,72,71,69\nbadlabel,70,72,71,69\nnormal,70,72,71,xx\nnormal,70,72\n";
		const res = AI.data.parseDatasetCsv(text);
		t.eq(res.errors.length, 3);
		t.eq(res.errors[0].line, 2);
		t.eq(res.errors[1].line, 3);
		t.eq(res.errors[2].line, 4);
		t.eq(res.samples.length, 1);
	});

	t.test("json round trip", () => {
		const ds = AI.data.generateDataset({ perClass: 4, k: 4, tol: 4, seed: 13 });
		const text = AI.data.datasetToJsonText(ds);
		const back = AI.data.parseDatasetJson(text);
		t.eq(back.errors, []);
		t.eq(back.dataset.samples, ds.samples);
		t.eq(back.dataset.meta.k, 4);
	});

	t.test("json rejects foreign format", () => {
		const res = AI.data.parseDatasetJson('{"format":"other"}');
		t.eq(res.errors.length, 1);
	});

	t.test("json bad syntax reports error", () => {
		const res = AI.data.parseDatasetJson("{oops");
		t.eq(res.errors.length, 1);
	});

	t.test("article examples present", () => {
		t.eq(AI.data.EXAMPLES.length, 3);
		const n = AI.data.EXAMPLES.find((e) => e.key === "normal");
		t.eq(n.bpm.length, 9);
		const b = AI.data.EXAMPLES.find((e) => e.key === "bradycardia");
		t.eq(b.bpm.length, 5);
		const x = AI.data.EXAMPLES.find((e) => e.key === "tachycardia");
		t.eq(x.bpm.length, 9);
	});

	t.test("exampleByKey returns examples by class key", () => {
		t.eq(AI.data.exampleByKey("normal").bpm[0], 72);
		t.eq(AI.data.exampleByKey("tachycardia").bpm.length, 9);
		t.eq(AI.data.exampleByKey("bradycardia").bpm.length, 5);
		t.eq(AI.data.exampleByKey("nope"), null);
	});
};
