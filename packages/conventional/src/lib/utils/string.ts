export const collapseWhitespace = (str: string): string => {
	str = str.trim();
	// Convert all tabs to spaces.
	str = str.replaceAll(/\t/g, " ");
	str = str.replaceAll(/ +/g, " ");
	return str;
};

export const lowerCaseFirstCharacter = (str: string): string => {
	const firstChar = str[0];
	if (!firstChar) {
		// str is empty
		return "";
	}

	return `${firstChar.toLowerCase()}${str.slice(1)}`;
};

export const upperCaseFirstCharacter = (str: string): string => {
	const firstChar = str[0];
	if (!firstChar) {
		// str is empty
		return "";
	}

	return `${firstChar.toUpperCase()}${str.slice(1)}`;
};

export const assertNoTrailingComma = (str: string): void => {
	// Trailing commas could indicate that the user is missing part of the
	// string (e.g. copy-and-paste error).
	if (str.endsWith(",")) {
		throw new Error(
			`ends w/ trailing comma "," (did you include the entire string?)`,
		);
	}
};

export const assertNoPunctuation = (str: string): void => {
	if (str.match(/[.!?]|\.\.\./)) {
		throw new Error(`contains punctuation`);
	}
};

export const removeTrailingPunctuation = (str: string): string => {
	assertNoTrailingComma(str);

	str = str.replace(/\W+$/, "");
	return str;
};

export const properlyPuncuate = (str: string): string => {
	assertNoTrailingComma(str);

	if (!str.match(/[.!?]|\.\.\.$/)) {
		str = `${str}.`;
	}
	return str;
};

export const unwrapText = (str: string): string => {
	const paragraphs = str.split("\n\n");
	return paragraphs
		.map((paragraph) => paragraph.split("\n").join(" "))
		.join("\n");
};

export const removeComments = (str: string): string => {
	return str
		.split("\n")
		.filter((line) => !line.startsWith("#"))
		.join("\n");
};
