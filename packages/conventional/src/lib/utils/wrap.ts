/*!
 * word-wrap <https://github.com/jonschlinkert/word-wrap>
 *
 * Copyright (c) 2014-2023, Jon Schlinkert.
 * Released under the MIT License.
 */

const trimEnd = (str: string): string => {
	let lastCharPos = str.length - 1;
	let lastChar = str[lastCharPos];
	while (lastChar === " " || lastChar === "\t") {
		lastChar = str[--lastCharPos];
	}
	return str.substring(0, lastCharPos + 1);
};

const trimTabAndSpaces = (str: string): string => {
	const lines = str.split("\n");
	const trimmedLines = lines.map((line) => trimEnd(line));
	return trimmedLines.join("\n");
};

export interface WrapOptions {
	/**
	 * The width of the text before wrapping to a new line.
	 */
	width: number;
}

export default function wrap(str: string, { width }: WrapOptions): string {
	if (str === "") {
		return str;
	}

	let regexString = `.{1,${width}}`;
	regexString += "([\\s\u200B]+|$)|[^\\s\u200B]+?([\\s\u200B]+|$)";
	const re = new RegExp(regexString, "g");
	const lines = str.match(re) || [];
	let result = lines
		.map((line) => {
			if (line.slice(-1) === "\n") {
				line = line.slice(0, line.length - 1);
			}
			return line;
		})
		.join("\n");

	result = trimTabAndSpaces(result);
	return result;
}
