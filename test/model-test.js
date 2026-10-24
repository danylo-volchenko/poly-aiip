"use strict";

module.exports = function (t)
{
	const AI = t.load(["util.js", "rng.js", "generator.js", "lib/brain.js", "model.js"]);

	function makeModel(opts)
	{
		return new AI.RhythmModel(Object.assign({
			k: 4,
			encoding: { min: 30, max: 150 },
		}, opts));
	}

	function dataset(seed)
	{
		const ds = AI.data.generateDataset({ perClass: 60, k: 4, tol: 4, seed: seed || 21 });
		return AI.data.splitSamples(ds.samples, 20, new AI.Random(2));
	}

	async function trained(opts, seed)
	{
		const split = dataset(seed);
		const model = makeModel();
		await model.train(split.train, split.test, Object.assign({ epochs: 100 }, opts));
		return { split, model };
	}

	t.test("constructor exposes brain.js defaults", () => {
		const m = makeModel();
		t.eq(AI.engine, { name: "brain.js", version: "2.0.0-beta.24" });
		t.eq(m.hidden, 8);
		t.eq(m.learningRate, 0.3);
		t.eq(m.momentum, 0.1);
		t.eq(m.net, null);
		t.eq(m.source, "trained");
		t.eq(m.history, { epoch: [], error: [], evalEpoch: [], trainAcc: [], testAcc: [] });
	});

	t.test("predictWindow rejects an untrained model", () => {
		let threw = false;
		try {
			makeModel().predictWindow([75, 75, 75, 75]);
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
		const m = makeModel();
		t.eq(m.encode(30), 0);
		t.eq(m.encode(150), 1);
		t.near(m.encode(75), 0.375, 1e-9);
		t.eq(m.encode(5), 0);
		t.eq(m.encode(200), 1);
	});

	t.test("train fills history and learns the three classes", async () => {
		const { split, model } = await trained();
		const hist = model.history;
		t.eq(hist.epoch.length, 100);
		t.eq(hist.error.length, 100);
		t.eq(hist.evalEpoch.length, 100);
		t.eq(hist.trainAcc.length, 100);
		t.eq(hist.testAcc.length, 100);
		t.ok(hist.error[hist.error.length - 1] < hist.error[0], "error did not decrease");
		t.ok(model.net, "net missing");
		t.ok(model.trainedAt, "trainedAt missing");
		t.eq(model.trainSize, split.train.length);
		t.eq(model.testSize, split.test.length);
		t.eq(model.predictWindow([50, 50, 50, 50]).label, "bradycardia");
		t.eq(model.predictWindow([75, 75, 75, 75]).label, "normal");
		t.eq(model.predictWindow([120, 120, 120, 120]).label, "tachycardia");
		const acc = model.accuracy(split.test);
		t.ok(acc > 0.75, `low accuracy: ${acc}`);
	});

	t.test("train applies hidden neurons, learning rate and momentum", async () => {
		const { model } = await trained({ hidden: 4, learningRate: 0.5, momentum: 0.2 });
		t.eq(model.hidden, 4);
		t.eq(model.learningRate, 0.5);
		t.eq(model.momentum, 0.2);
		t.eq(model.toJSON().net.sizes, [4, 4, 3]);
	});

	t.test("train early stop on error threshold", async () => {
		const split = dataset();
		const model = makeModel();
		const hist = await model.train(split.train, split.test, { epochs: 2000, errorThresh: 0.1 });
		t.ok(hist.epoch.length < 2000, "no early stop");
		t.ok(hist.error[hist.error.length - 1] <= 0.1, "error above threshold");
	});

	t.test("train shouldStop interrupts after one epoch", async () => {
		const split = dataset();
		const model = makeModel();
		const hist = await model.train(split.train, split.test, { epochs: 100 }, {
			shouldStop: () => true,
		});
		t.eq(hist.epoch.length, 1);
	});

	t.test("train reports progress through onEpoch", async () => {
		const split = dataset();
		const model = makeModel();
		const seen = [];
		await model.train(split.train, split.test, { epochs: 12 }, {
			onEpoch(h) {
				seen.push(h.epoch);
			},
		});
		t.eq(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});

	t.test("predictWindow probs sum to 1", async () => {
		const { model } = await trained({}, 22);
		const r = model.predictWindow([65, 75, 80, 72]);
		t.ok(Math.abs(r.probs.reduce((a, b) => a + b, 0) - 1) < 1e-9, "probs not normalized");
		t.ok(r.confidence > 0 && r.confidence <= 1, "confidence out of range");
	});

	t.test("predictWindow gives high confidence on clean in-distribution windows", async () => {
		const { model } = await trained({}, 22);
		const b = model.predictWindow([45, 47, 46, 48]);
		const n = model.predictWindow([75, 76, 74, 77]);
		const ta = model.predictWindow([115, 116, 114, 117]);
		t.eq(b.label, "bradycardia");
		t.eq(n.label, "normal");
		t.eq(ta.label, "tachycardia");
		t.ok(b.confidence > 0.7, `brady confidence too low: ${b.confidence}`);
		t.ok(n.confidence > 0.7, `normal confidence too low: ${n.confidence}`);
		t.ok(ta.confidence > 0.7, `tachy confidence too low: ${ta.confidence}`);
	});

	t.test("predictSeries slides windows", async () => {
		const { model } = await trained();
		const r = model.predictSeries([70, 72, 68, 71, 69, 73, 70, 68, 74]);
		t.eq(r.windows, 6);
		t.eq(r.label, "normal");
		t.eq(r.perWindow.length, 6);
	});

	t.test("predictSeries rejects short input", async () => {
		const { model } = await trained();
		let threw = false;
		try {
			model.predictSeries([70, 72]);
		} catch (e) {
			threw = true;
		}
		t.ok(threw, "expected throw");
	});

	t.test("evaluate computes confusion and metrics", async () => {
		const { split, model } = await trained();
		const res = await model.evaluate(split.test);
		t.eq(res.confusion.length, 3);
		t.eq(res.confusion[0].length, 3);
		const total = res.confusion.flat().reduce((a, b) => a + b, 0);
		t.eq(total, split.test.length);
		t.ok(res.accuracy > 0.75, `low accuracy: ${res.accuracy}`);
		t.ok(res.macroF1 > 0.7, `low macro f1: ${res.macroF1}`);
		t.ok(res.crossEntropy > 0, `cross entropy: ${res.crossEntropy}`);
		for (const c of res.perClass) {
			t.ok(c.precision >= 0 && c.precision <= 1, `precision out of range: ${c.precision}`);
			t.ok(c.recall >= 0 && c.recall <= 1, `recall out of range: ${c.recall}`);
		}
	});

	t.test("evaluate reports progress", async () => {
		const { split, model } = await trained();
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
		const { model } = await trained();
		const json = model.toJSON();
		t.eq(json.format, "aiip-model");
		t.eq(json.version, 2);
		t.eq(json.engine, "brain.js");
		t.eq(json.hidden, model.hidden);
		t.eq(json.learningRate, model.learningRate);
		t.eq(json.momentum, model.momentum);
		t.ok(json.net && Array.isArray(json.net.layers), "net json missing");

		const m2 = AI.RhythmModel.fromJSON(JSON.parse(JSON.stringify(json)));
		t.eq(m2.k, model.k);
		t.eq(m2.hidden, model.hidden);
		t.eq(m2.encoding, model.encoding);
		t.eq(m2.history.epoch.length, 100);
		t.eq(m2.source, "file");
		const a = model.predictWindow([75, 75, 75, 75]);
		const b = m2.predictWindow([75, 75, 75, 75]);
		t.eq(b.label, a.label);
		for (let i = 0; i < a.probs.length; i++)
			t.near(b.probs[i], a.probs[i], 1e-9);
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

	t.test("fromJSON rejects the threshold-era version", async () => {
		const { model } = await trained();
		const json = model.toJSON();
		json.version = 1;
		let threw = false;
		try {
			AI.RhythmModel.fromJSON(json);
		} catch (e) {
			threw = true;
		}
		t.ok(threw, "expected throw");
	});

	t.test("fromJSON rejects a missing network", async () => {
		const { model } = await trained();
		const json = model.toJSON();
		delete json.net;
		let threw = false;
		try {
			AI.RhythmModel.fromJSON(json);
		} catch (e) {
			threw = true;
		}
		t.ok(threw, "expected throw");
	});
};
