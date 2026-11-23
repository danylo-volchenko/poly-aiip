"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "src", "js");
const libDir = path.join(__dirname, "..", "src", "lib");

function load(mods)
{
	const ctx = {
		window: {},
		console,
		process,
		setTimeout,
		clearTimeout,
		crypto,
		performance,
		requestAnimationFrame: (fn) => setTimeout(fn, 16),
	};
	vm.createContext(ctx);
	for (const m of mods) {
		const file = m.startsWith("lib/")
			? path.join(libDir, m.slice(4))
			: path.join(srcDir, m);
		const code = fs.readFileSync(file, "utf8");
		vm.runInContext(code, ctx, { filename: m });
	}
	return ctx.window.AIIP;
}

function parseArgs(argv)
{
	const opts = {
		quick: false,
		out: path.join(__dirname, "results.json"),
		repeats: null,
	};

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--quick") {
			opts.quick = true;
		} else if (a === "--out") {
			if (!argv[i + 1])
				throw new Error("--out needs a path");
			opts.out = path.resolve(argv[++i]);
		} else if (a === "--repeats") {
			opts.repeats = Number(argv[++i]);
			if (!Number.isInteger(opts.repeats) || opts.repeats < 1)
				throw new Error("--repeats must be a positive integer");
		} else if (a === "--help" || a === "-h") {
			opts.help = true;
		} else {
			throw new Error("unknown argument: " + a);
		}
	}
	return opts;
}

function csvPathFor(out)
{
	return /\.json$/i.test(out) ? out.replace(/\.json$/i, ".csv") : out + ".csv";
}

function ms(v)
{
	return v === null || v === undefined ? "n/a" : v.toFixed(3);
}

const SYMBOLS = {
	inference: "N",
	evaluation: "S",
	training: "S",
	"window-k": "K",
	epochs: "epochs",
	"worker-main": "path",
};

function printCase(c)
{
	const symbol = SYMBOLS[c.id] || c.param;
	const left = (c.id + " " + symbol + "=" + c.param).padEnd(34);
	if (!c.runs.length) {
		console.log(left + "skipped   " + (c.notes || ""));
		return;
	}
	console.log(left +
		"min " + ms(c.min).padStart(9) +
		"   mean " + ms(c.mean).padStart(9) +
		"   median " + ms(c.median).padStart(9) + " ms");
}

function validate(result)
{
	if (!result || !result.meta || !Array.isArray(result.cases))
		throw new Error("bad result shape");
	if (!result.meta.startedAt || !result.meta.env || !result.meta.config)
		throw new Error("bad result meta");
	for (const c of result.cases) {
		for (const key of ["id", "title", "param", "unit", "params", "runs",
			"min", "max", "mean", "median", "notes"]) {
			if (!(key in c))
				throw new Error(`case ${c.id || "?"} missing ${key}`);
		}
		if (!Array.isArray(c.runs))
			throw new Error(`case ${c.id} runs is not an array`);
		for (const v of c.runs)
			if (!Number.isFinite(v))
				throw new Error(`case ${c.id} has a non-finite run`);
	}
}

async function main()
{
	const opts = parseArgs(process.argv.slice(2));
	if (opts.help) {
		console.log("usage: node bench/run.js [--quick] [--out FILE] [--repeats N]");
		return;
	}

	const AI = load(["util.js", "rng.js", "generator.js", "lib/brain.js",
		"model.js", "bench.js"]);
	const bench = AI.bench;
	if (!bench)
		throw new Error("AIIP.bench is not loaded");

	const t0 = Date.now();
	const result = await bench.run({
		quick: opts.quick,
		repeats: opts.repeats || undefined,
	}, {
		onCase: printCase,
	});

	result.meta.env.cpu = os.cpus().length ? os.cpus()[0].model.trim() : null;
	result.meta.env.cpus = os.cpus().length;
	result.meta.env.totalMemBytes = os.totalmem();
	result.meta.env.v8 = process.versions.v8;
	result.meta.elapsedMs = Date.now() - t0;
	validate(result);

	const jsonPath = opts.out;
	const csvPath = csvPathFor(jsonPath);
	fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
	fs.writeFileSync(jsonPath, bench.toJson(result));
	fs.writeFileSync(csvPath, bench.toCsv(result));

	console.log("");
	console.log("cases: " + result.cases.length +
		" | repeats: " + result.meta.config.repeats +
		" | quick: " + result.meta.config.quick);
	console.log("wrote " + jsonPath);
	console.log("wrote " + csvPath);
}

main().catch((e) => {
	console.error("bench failed: " + e.message);
	process.exit(1);
});
