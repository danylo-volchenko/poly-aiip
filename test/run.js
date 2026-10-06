"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const srcDir = path.join(__dirname, "..", "src", "js");

let pass = 0;
let fail = 0;

function load(mods)
{
	const ctx = {
		window: {},
		console,
		setTimeout,
		crypto,
		performance,
		requestAnimationFrame: (fn) => setTimeout(fn, 16),
	};
	vm.createContext(ctx);
	for (const m of mods) {
		const code = fs.readFileSync(path.join(srcDir, m), "utf8");
		vm.runInContext(code, ctx, { filename: m });
	}
	return ctx.window.AIIP;
}

function eq(actual, expected, msg)
{
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a !== b)
		throw new Error(`${msg || "not equal"}: expected ${b}, got ${a}`);
}

function ok(cond, msg)
{
	if (!cond)
		throw new Error(msg || "condition false");
}

function near(actual, expected, eps, msg)
{
	if (!Number.isFinite(actual) || Math.abs(actual - expected) > eps)
		throw new Error(`${msg || "not near"}: expected ${expected}±${eps}, got ${actual}`);
}

const pending = [];

function test(name, fn)
{
	const p = Promise.resolve()
		.then(() => fn())
		.then(() => {
			pass++;
			console.log(`ok ${pass + fail} - ${name}`);
		})
		.catch((e) => {
			fail++;
			console.log(`not ok ${pass + fail} - ${name}`);
			console.log(`  ${String(e.message).split("\n")[0]}`);
		});
	pending.push(p);
	return p;
}

const t = { load, eq, ok, near, test };

async function main()
{
	const args = process.argv.slice(2);
	const list = args.length ? args : fs.readdirSync(__dirname)
		.filter((f) => f.endsWith("-test.js"))
		.sort()
		.map((f) => path.join(__dirname, f));

	for (const f of list) {
		const mod = require(path.resolve(f));
		await mod(t);
	}

	await Promise.all(pending);
	console.log(`\n${pass} passed, ${fail} failed`);
	process.exitCode = fail ? 1 : 0;
}

main();
