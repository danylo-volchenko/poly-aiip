(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};

	const MAX_SEED = 1000000000;

	class Random
	{
		constructor(seed)
		{
			this.seed = seed >>> 0;
			this.s = seed >>> 0;
		}

		raw()
		{
			this.s = (this.s + 0x6d2b79f5) >>> 0;
			let t = this.s;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		}

		float(min, max)
		{
			return min + this.raw() * (max - min);
		}

		int(min, max)
		{
			return min + Math.floor(this.raw() * (max - min + 1));
		}

		shuffle(arr)
		{
			for (let i = arr.length - 1; i > 0; i--) {
				const j = this.int(0, i);
				const tmp = arr[i];
				arr[i] = arr[j];
				arr[j] = tmp;
			}
			return arr;
		}

		pick(arr)
		{
			return arr[this.int(0, arr.length - 1)];
		}
	}

	function randomSeed()
	{
		const buf = new Uint32Array(1);
		crypto.getRandomValues(buf);
		return buf[0] % MAX_SEED;
	}

	AIIP.Random = Random;
	AIIP.randomSeed = randomSeed;
	AIIP.MAX_SEED = MAX_SEED;
})();
