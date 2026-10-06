"use strict";

module.exports = function (t)
{
	const AI = t.load(["util.js", "rng.js", "generator.js", "model.js"]);

	function fixedModel()
	{
		return new AI.RhythmModel({
			k: 4,
			boundaries: { low: 60, high: 100 },
			encoding: { min: 30, max: 150 },
		});
	}

	function trainedModel()
	{
		const ds = AI.data.generateDataset({ perClass: 50, k: 4, tol: 4, seed: 21 });
		const split = AI.data.splitSamples(ds.samples, 20, new AI.Random(2));
		return { split, model: fixedModel() };
	}

	t.test("predictWindow classifies three zones", () => {
		const m = fixedModel();
		t.eq(m.predictWindow([50, 50, 50, 50]).label, "bradycardia");
		t.eq(m.predictWindow([75, 75, 75, 75]).label, "normal");
		t.eq(m.predictWindow([120, 120, 120, 120]).label, "tachycardia");
	});

	t.test("predictWindow probs sum to 1", () => {
		const m = fixedModel();
		const r = m.predictWindow([65, 75, 80, 72]);
		t.ok(Math.abs(r.probs.reduce((a, b) => a + b, 0) - 1) < 1e-9, "probs not normalized");
		t.ok(r.confidence > 0 && r.confidence <= 1, "confidence out of range");
	});

	t.test("predictSeries slides windows", () => {
		const m = fixedModel();
		const r = m.predictSeries([70, 72, 68, 71, 69, 73, 70, 68, 74]);
		t.eq(r.windows, 6);
		t.eq(r.label, "normal");
		t.eq(r.perWindow.length, 6);
	});

	t.test("predictSeries rejects short input", () => {
		const m = fixedModel();
		let threw = false;
		try {
			m.predictSeries([70, 72]);
		} catch (e) {
			threw = true;
		}
		t.ok(threw, "expected throw");
	});

	t.test("encodingFor pads min and max by 10", () => {
		const samples = [
			{ label: "normal", bpm: [70, 72] },
			{ label: "bradycardia", bpm: [50, 48] },
		];
		t.eq(AI.RhythmModel.encodingFor(samples), { min: 30, max: 90 });
	});

	t.test("encode normalizes bpm into unit range", () => {
		const m = fixedModel();
		t.eq(m.encode(30), 0);
		t.eq(m.encode(150), 1);
		t.near(m.encode(75), 0.375, 1e-9);
		t.eq(m.encode(5), 0);
		t.eq(m.encode(200), 1);
	});

	t.test("train finds boundaries and fills history", async () => {
		const { split, model } = trainedModel();
		const hist = await model.train(split.train, split.test, { epochs: 100 });
		t.eq(hist.epoch.length, 100);
		t.ok(model.boundaries.low >= 55 && model.boundaries.low <= 68, `low off: ${model.boundaries.low}`);
		t.ok(model.boundaries.high >= 92 && model.boundaries.high <= 108, `high off: ${model.boundaries.high}`);
		const acc = model.accuracy(split.test);
		t.ok(acc > 0.9, `low accuracy: ${acc}`);
	});

	t.test("train early stop on error threshold", async () => {
		const { split, model } = trainedModel();
		const hist = await model.train(split.train, split.test, { epochs: 2000, errorThresh: 0.05 });
		t.ok(hist.epoch.length < 2000, "no early stop");
		t.ok(hist.error[hist.error.length - 1] <= 0.05, "error above threshold");
	});

	t.test("train shouldStop interrupts after epoch", async () => {
		const { split, model } = trainedModel();
		const hist = await model.train(split.train, split.test, { epochs: 100 }, { shouldStop: () => true });
		t.eq(hist.epoch.length, 1);
	});

	t.test("evaluate computes confusion and metrics", async () => {
		const { split, model } = trainedModel();
		const res = await model.evaluate(split.test);
		t.eq(res.confusion.length, 3);
		t.eq(res.confusion[0].length, 3);
		const total = res.confusion.flat().reduce((a, b) => a + b, 0);
		t.eq(total, split.test.length);
		t.ok(res.accuracy > 0.9, `low accuracy: ${res.accuracy}`);
		t.ok(res.macroF1 > 0.9, `low macro f1: ${res.macroF1}`);
		for (const c of res.perClass) {
			t.ok(c.precision >= 0 && c.precision <= 1, `precision out of range: ${c.precision}`);
			t.ok(c.recall >= 0 && c.recall <= 1, `recall out of range: ${c.recall}`);
		}
	});

	t.test("evaluate reports progress", async () => {
		const { split, model } = trainedModel();
		let last = -1;
		let total = 0;
		await model.evaluate(split.test, {
			onProgress: (done, n) => {
				last = done;
				total = n;
			},
		});
		t.eq(last, split.test.length);
		t.eq(total, split.test.length);
	});

	t.test("model json round trip", async () => {
		const { split, model } = trainedModel();
		await model.train(split.train, split.test, { epochs: 20 });
		const m2 = AI.RhythmModel.fromJSON(model.toJSON());
		t.eq(m2.boundaries, model.boundaries);
		t.eq(m2.k, model.k);
		t.eq(m2.encoding, model.encoding);
		t.eq(m2.history.epoch.length, 20);
		t.eq(m2.predictWindow([75, 75, 75, 75]).label, model.predictWindow([75, 75, 75, 75]).label);
		t.eq(m2.source, "file");
	});

	t.test("fromJSON rejects foreign format", () => {
		let threw = false;
		try {
			AI.RhythmModel.fromJSON({ format: "nope" });
		} catch (e) {
			threw = true;
		}
		t.ok(threw, "expected throw");
	});
};
