(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};

	// Executed inside a Blob-URL Web Worker. model.js concatenates the vendored
	// brain.js source in front of workerMain.toString(), so `brain` is a global
	// there and importScripts("file://...") -- blocked by Chrome -- is never used.
	function workerMain()
	{
		"use strict";

		let stop = false;

		function argmax(arr)
		{
			let best = 0;
			for (let i = 1; i < arr.length; i++)
				if (arr[i] > arr[best])
					best = i;
			return best;
		}

		function accuracy(net, set, keys)
		{
			if (!set || !set.rows.length)
				return null;
			let hits = 0;
			for (let i = 0; i < set.rows.length; i++) {
				const out = net.run(set.rows[i].input);
				const vals = Array.isArray(out) ? out : keys.map((k) => out[k] || 0);
				if (argmax(vals) === set.labels[i])
					hits++;
			}
			return hits / set.rows.length;
		}

		async function train(msg)
		{
			const data = msg.data;
			const cfg = msg.config;
			const evalEvery = Math.max(1, msg.evalEvery || 1);
			const net = new brain.NeuralNetwork(cfg.layers);
			const trainOpts = {
				iterations: 1,
				learningRate: cfg.learningRate,
				momentum: cfg.momentum,
				log: false,
			};
			const history = { epoch: [], error: [], evalEpoch: [], trainAcc: [], testAcc: [] };
			const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
			let lastYield = Date.now();

			for (let e = 1; e <= cfg.epochs; e++) {
				const res = net.train(data.train.rows, trainOpts);
				const error = res.error;
				let trainAcc = null;
				let testAcc = null;
				history.epoch.push(e);
				history.error.push(error);
				if (e === 1 || e % evalEvery === 0 || e === cfg.epochs) {
					trainAcc = accuracy(net, data.train, cfg.keys);
					testAcc = accuracy(net, data.test, cfg.keys);
					history.evalEpoch.push(e);
					history.trainAcc.push(trainAcc);
					history.testAcc.push(testAcc);
				}
				self.postMessage({
					type: "progress",
					epoch: e,
					error,
					trainAcc,
					testAcc,
				});
				if (stop || (cfg.errorThresh > 0 && error <= cfg.errorThresh))
					break;
				if (Date.now() - lastYield > 16) {
					await pause();
					lastYield = Date.now();
				}
			}
			self.postMessage({ type: "done", netJSON: net.toJSON(), history });
		}

		self.onmessage = (ev) => {
			const msg = ev.data || {};
			if (msg.type === "stop") {
				stop = true;
				return;
			}
			if (msg.type !== "train")
				return;
			train(msg).catch((e) => {
				self.postMessage({
					type: "error",
					message: String(e && e.message ? e.message : e),
				});
			});
		};
	}

	AIIP.trainWorkerMain = workerMain;
})();
