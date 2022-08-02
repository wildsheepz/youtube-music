const { join } = require("path");

const { ipcMain } = require("electron");
const is = require("electron-is");
const { convert } = require("html-to-text");
const fetch = require("node-fetch");

const { cleanupName } = require("../../providers/song-info");
const { injectCSS } = require("../utils");

const regExp = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/g;

module.exports = async (win) => {
	injectCSS(win.webContents, join(__dirname, "style.css"));

	ipcMain.on("search-genius-lyrics", async (event, extractedSongInfo) => {
		const metadata = JSON.parse(extractedSongInfo);
		event.returnValue = await fetchFromEither(metadata)
	});
};

const fetchFromEither = async (metadata) => {
	try {
		var lyrics = await fetchFromOther(metadata);
		if (lyrics == null) {
			lyrics = await fetchFromGenius(metadata);
		}
		return lyrics
	} catch (e) {
		return null
	}
}

const fetchFromOther = async (metadata) => {
	const queryString = `${cleanupName(metadata.artist)} ${cleanupName(
		metadata.title
	)}`;
	let urlstring = `https://www.kkbox.com/api/search/song?q=${encodeURI(queryString)}`

	if (is.dev()) {
		console.log("Searching on KKBox:", queryString);
	}

	let response = await fetch(urlstring);
	if (!response.ok) {
		return null;
	}

	const info = await response.json();
	let url = "";
	try {
		url = info.data.result.filter((result) => result.has_lyrics === true)[0]
			.url;
	} catch {
		return null;
	}

	if (is.dev()) {
		console.log("Fetching lyrics from KKBox:", url);
	}

	response = await fetch(url);
	if (!response.ok) {
		return null;
	}

	const html = await response.text();
	const lyrics = convert(html, {
		baseElements: {
			selectors: ['[class^="Lyrics__Container"]', ".lyrics"],
		},
		selectors: [
			{
				selector: "a",
				format: "linkFormatter",
			},
		],
		formatters: {
			// Remove links by keeping only the content
			linkFormatter: (elem, walk, builder) => {
				walk(elem.children, builder);
			},
		},
	});

	if (is.dev()) {
		console.log("fetchFromKKBox: Done");
	}
	return lyrics;
}

const fetchFromGenius = async (metadata) => {
	const queryString = `${cleanupName(metadata.artist)} ${cleanupName(
		metadata.title
	)}`;
	let urlstring = `https://genius.com/api/search/multi?per_page=5&q=${encodeURI(queryString)}`
	if (is.dev()) {
		console.log("Searching on Genius:", queryString);
	}
	let response = await fetch(urlstring);
	if (!response.ok) {
		return null;
	}

	const info = await response.json();
	let url = "";
	try {
		url = info.response.sections.filter((section) => section.type === "song")[0]
			.hits[0].result.url;
	} catch {
		return null;
	}

	if (is.dev()) {
		console.log("Fetching lyrics from Genius:", url);
	}

	response = await fetch(url);
	if (!response.ok) {
		return null;
	}

	const html = await response.text();
	const lyrics = convert(html, {
		baseElements: {
			selectors: ['[class^="Lyrics__Container"]', ".lyrics"],
		},
		selectors: [
			{
				selector: "a",
				format: "linkFormatter",
			},
		],
		formatters: {
			// Remove links by keeping only the content
			linkFormatter: (elem, walk, builder) => {
				walk(elem.children, builder);
			},
		},
	});
	if (is.dev()) {
		console.log("fetchFromGenius: Done");
	}
	return lyrics;
};

module.exports.fetchFromOther = fetchFromOther;
module.exports.fetchFromGenius = fetchFromGenius;
