(function ()
{
	"use strict";

	const AIIP = window.AIIP = window.AIIP || {};

	const LEVELS = ["info", "success", "warning", "error"];

	let listEl = null;
	let countEl = null;
	const entries = [];

	function init(els)
	{
		listEl = els.list;
		countEl = els.count;
	}

	function render(entry)
	{
		if (!listEl)
			return;
		const row = document.createElement("div");
		row.className = "log-entry log-" + entry.level;

		const time = document.createElement("span");
		time.className = "log-time";
		const ms = String(entry.time % 1000).padStart(3, "0");
		time.textContent = new Date(entry.time).toLocaleTimeString("en-GB", { hour12: false }) + "." + ms;

		const badge = document.createElement("span");
		badge.className = "log-badge";
		badge.textContent = entry.level;

		const text = document.createElement("span");
		text.className = "log-text";
		text.textContent = entry.message;

		row.append(time, badge, text);
		listEl.appendChild(row);
		listEl.scrollTop = listEl.scrollHeight;
	}

	function log(level, message)
	{
		const entry = { time: Date.now(), level, message };
		entries.push(entry);
		render(entry);
		if (countEl)
			countEl.textContent = String(entries.length);
		return entry;
	}

	function clear()
	{
		entries.length = 0;
		if (listEl)
			listEl.replaceChildren();
		if (countEl)
			countEl.textContent = "0";
	}

	function info(message)
	{
		return log("info", message);
	}

	function success(message)
	{
		return log("success", message);
	}

	function warning(message)
	{
		return log("warning", message);
	}

	function error(message)
	{
		return log("error", message);
	}

	AIIP.logger = {
		LEVELS,
		init,
		log,
		info,
		success,
		warning,
		error,
		clear,
		count: () => entries.length,
		entries: () => entries.slice(),
	};
})();
