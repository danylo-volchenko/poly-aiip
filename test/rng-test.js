"use strict";

module.exports = function (t)
{
	const AI = t.load(["util.js", "rng.js"]);

	t.test("same seed gives same sequence", () => {
		const a = new AI.Random(1234);
		const b = new AI.Random(1234);
		for (let i = 0; i < 100; i++)
			t.eq(a.float(0, 1), b.float(0, 1));
	});

	t.test("different seeds diverge", () => {
		const a = new AI.Random(1);
		const b = new AI.Random(2);
		let diff = false;
		for (let i = 0; i < 10; i++) {
			if (a.float(0, 1) !== b.float(0, 1))
				diff = true;
		}
		t.ok(diff, "sequences identical");
	});

	t.test("float stays inside range", () => {
		const r = new AI.Random(7);
		for (let i = 0; i < 1000; i++) {
			const v = r.float(40, 140);
			t.ok(v >= 40 && v < 140, `out of range: ${v}`);
		}
	});

	t.test("int is inclusive on both ends", () => {
		const r = new AI.Random(7);
		let low = false;
		let high = false;
		for (let i = 0; i < 500; i++) {
			const v = r.int(1, 3);
			t.ok(v >= 1 && v <= 3, `out of range: ${v}`);
			if (v === 1)
				low = true;
			if (v === 3)
				high = true;
		}
		t.ok(low, "never hit 1");
		t.ok(high, "never hit 3");
	});

	t.test("shuffle permutes in place", () => {
		const r = new AI.Random(99);
		const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const out = r.shuffle(arr);
		t.eq(out, arr);
		t.eq(arr.slice().sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});

	t.test("pick returns an element", () => {
		const r = new AI.Random(5);
		t.ok([1, 2, 3].includes(r.pick([1, 2, 3])), "not in array");
	});

	t.test("randomSeed stays in range", () => {
		for (let i = 0; i < 5; i++) {
			const s = AI.randomSeed();
			t.ok(Number.isInteger(s) && s >= 0 && s < AI.MAX_SEED, `bad seed: ${s}`);
		}
	});
};
