"use strict";

module.exports = function (t)
{
	const AI = t.load(["util.js", "rng.js", "generator.js", "lib/brain.js",
		"model.js", "bench.js"]);
	const bench = AI.bench;

	const CASE_KEYS = ["id", "title", "param", "unit", "params", "runs",
		"min", "max", "mean", "median", "notes"];

	let tinyPromise = null;

	function tinyRun()
	{
		if (!tinyPromise) {
			tinyPromise = bench.run({
				scenarios: ["inference", "training"],
				seriesLengths: [120],
				datasetSizes: [120],
				k: 4,
				epochs: 2,
				repeats: 1,
				seed: 5,
			});
		}
		return tinyPromise;
	}

	t.test("bench stats rounds to three decimals", () => {
		t.eq(bench.stats([4, 1, 3, 2]),
			{ runs: [4, 1, 3, 2], min: 1, max: 4, mean: 2.5, median: 2.5 });
		t.eq(bench.stats([9, 2, 5]).runs, [9, 2, 5]);
		const s = bench.stats([2.34567, 1.23456]);
		t.eq(s.min, 1.235);
		t.eq(s.max, 2.346);
		t.eq(s.mean, 1.79);
		t.eq(s.median, 1.79);
		t.eq(bench.stats([]),
			{ runs: [], min: null, max: null, mean: null, median: null });
	});

	t.test("bench series is deterministic and mixed-class", () => {
		const a = bench.series(150, 11);
		const b = bench.series(150, 11);
		const c = bench.series(150, 12);
		t.eq(a, b);
		t.eq(a.length, 150);
		t.ok(JSON.stringify(a) !== JSON.stringify(c), "seed has no effect");
		t.ok(a[0] >= 40 && a[0] <= 60, "first value is not bradycardia: " + a[0]);
		t.ok(a[1] > 60 && a[1] <= 100, "second value is not normal: " + a[1]);
		t.ok(a[2] > 100 && a[2] <= 140, "third value is not tachycardia: " + a[2]);
		for (const v of a)
			t.ok(Number.isFinite(v) && v >= 40 && v <= 140, "bad bpm " + v);
	});

	t.test("bench dataset is deterministic and shaped like the generator", () => {
		const a = bench.dataset(300, 7, 4);
		const b = bench.dataset(300, 7, 4);
		t.eq(a, b);
		t.eq(a.all.length, 300);
		t.eq(a.train.length, 240);
		t.eq(a.test.length, 60);
		t.eq(a.meta.k, 4);
		t.eq(a.meta.samples, 300);
		for (const s of a.all) {
			t.ok(typeof s.label === "string", "bad label");
			t.eq(s.bpm.length, 4);
			for (const v of s.bpm)
				t.ok(Number.isFinite(v), "bad bpm value");
		}
	});

	t.test("bench run returns the frozen case schema", async () => {
		const r = await tinyRun();
		t.eq(r.cases.length, 2);
		t.ok(typeof r.meta.startedAt === "string", "startedAt missing");
		t.ok(r.meta.env && typeof r.meta.env === "object", "env missing");
		t.ok(Array.isArray(r.meta.notes), "notes missing");
		t.eq(r.meta.config.repeats, 1);
		for (const c of r.cases) {
			t.eq(Object.keys(c).sort(), CASE_KEYS.slice().sort());
			t.ok(!("runsCount" in c), "unexpected runsCount");
			t.eq(c.runs.length, 1);
			t.ok(Number.isFinite(c.runs[0]), "run time not finite");
			t.ok(Number.isFinite(c.min) && Number.isFinite(c.max) &&
				Number.isFinite(c.mean) && Number.isFinite(c.median),
				"stats not finite");
		}
	});

	t.test("bench tiny run honours overrides in params", async () => {
		const r = await tinyRun();
		const inf = r.cases.find((c) => c.id === "inference");
		const tr = r.cases.find((c) => c.id === "training");
		t.eq(inf.param, 120);
		t.eq(inf.params, { n: 120, k: 4 });
		t.eq(tr.param, 120);
		t.eq(tr.params.epochs, 2);
		t.eq(tr.params.k, 4);
		t.eq(tr.params.samples, 120);
	});

	t.test("bench CSV and JSON serialisers match the schema", async () => {
		const r = await tinyRun();
		const lines = bench.toCsv(r).trim().split("\n");
		t.eq(lines[0], "case,title,param,unit,params,run,ms,min,max,mean,median,notes");
		t.eq(lines.length, 3);
		const json = JSON.parse(bench.toJson(r));
		t.eq(json.cases.length, r.cases.length);
		t.eq(json.meta.config.k, r.meta.config.k);
	});

	t.test("bench run keeps the legacy sizes alias", async () => {
		const r = await bench.run({
			scenarios: ["inference"],
			repeats: 1,
			seed: 5,
			sizes: { inference: [140] },
		});
		t.eq(r.cases.length, 1);
		t.eq(r.cases[0].param, 140);
		t.eq(r.cases[0].params.n, 140);
		t.eq(r.meta.config.sizes.inference, [140]);
	});

	t.test("bench run sanitises invalid overrides without throwing", async () => {
		const r = await bench.run({
			scenarios: ["inference"],
			seriesLengths: [50, 140],
			k: 1,
			epochs: 9999,
			repeats: 1,
			seed: 5,
		});
		t.eq(r.meta.config.k, 4);
		t.eq(r.meta.config.epochs, 20);
		t.eq(r.meta.config.sizes.inference, [140]);
		t.eq(r.cases.length, 1);
		t.eq(r.cases[0].param, 140);
		t.ok(r.meta.notes.length >= 3, "expected sanitisation notes");
	});

	t.test("bench K and epochs scenarios keep their fixed sweeps", async () => {
		let stop = false;
		const r4 = await bench.run({
			scenarios: ["window-k"],
			k: 16,
			repeats: 1,
			seed: 5,
		}, {
			onCase() {
				stop = true;
			},
			shouldStop() {
				return stop;
			},
		});
		t.eq(r4.cases.length, 1);
		t.eq(r4.cases[0].param, 4);
		t.eq(r4.cases[0].params.k, 4);

		stop = false;
		const r5 = await bench.run({
			scenarios: ["epochs"],
			k: 16,
			epochs: 3,
			repeats: 1,
			seed: 5,
		}, {
			onCase() {
				stop = true;
			},
			shouldStop() {
				return stop;
			},
		});
		t.eq(r5.cases.length, 1);
		t.eq(r5.cases[0].param, 10);
		t.eq(r5.cases[0].params.k, 16);
	});
};
