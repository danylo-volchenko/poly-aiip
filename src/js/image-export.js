(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};
	const u = AIIP.util;

	const MIME = {
		png: "image/png",
		jpg: "image/jpeg",
		bmp: "image/bmp",
	};

	function saveBlob(blob, filename)
	{
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
		return { name: filename, size: blob.size };
	}

	function saveText(text, filename)
	{
		return saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
	}

	function encodeBmp(image)
	{
		const width = image.width;
		const height = image.height;
		const pixels = image.data;
		const rowSize = Math.floor((24 * width + 31) / 32) * 4;
		const pixelSize = rowSize * height;
		const headerSize = 54;
		const buffer = new ArrayBuffer(headerSize + pixelSize);
		const view = new DataView(buffer);
		const bytes = new Uint8Array(buffer);

		bytes[0] = 0x42;
		bytes[1] = 0x4d;
		view.setUint32(2, buffer.byteLength, true);
		view.setUint32(10, headerSize, true);
		view.setUint32(14, 40, true);
		view.setInt32(18, width, true);
		view.setInt32(22, height, true);
		view.setUint16(26, 1, true);
		view.setUint16(28, 24, true);
		view.setUint32(34, pixelSize, true);
		view.setInt32(38, 2835, true);
		view.setInt32(42, 2835, true);

		for (let y = 0; y < height; y++) {
			const targetY = height - 1 - y;
			for (let x = 0; x < width; x++) {
				const src = (y * width + x) * 4;
				const dst = headerSize + targetY * rowSize + x * 3;
				bytes[dst] = pixels[src + 2];
				bytes[dst + 1] = pixels[src + 1];
				bytes[dst + 2] = pixels[src];
			}
		}
		return bytes;
	}

	function canvasBlob(canvas, fmt)
	{
		if (fmt === "bmp") {
			const ctx = canvas.getContext("2d");
			const bytes = encodeBmp(ctx.getImageData(0, 0, canvas.width, canvas.height));
			return Promise.resolve(new Blob([bytes], { type: MIME.bmp }));
		}
		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob)
					resolve(blob);
				else
					reject(new Error(`canvas encoding failed for ${fmt}`));
			}, MIME[fmt], 0.92);
		});
	}

	function saveCanvas(canvas, fmt, baseName)
	{
		const filename = `${baseName}_${u.timestamp()}.${fmt}`;
		return canvasBlob(canvas, fmt).then((blob) => saveBlob(blob, filename));
	}

	function probeSizes(canvas)
	{
		const fmts = ["png", "jpg", "bmp"];
		return Promise.all(fmts.map((f) => canvasBlob(canvas, f)))
			.then((blobs) => {
				const sizes = {};
				fmts.forEach((f, i) => sizes[f] = blobs[i].size);
				return sizes;
			});
	}

	AIIP.imageExport = { MIME, saveBlob, saveText, encodeBmp, canvasBlob, saveCanvas, probeSizes };
})();
