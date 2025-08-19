import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { findConfig } from "../lib/config.js";
import type { CommitMessage, Footer } from "../lib/types.js";
import { removeElements, uniqueBy } from "../lib/utils/array.js";
import { formatError, normalizeError } from "../lib/utils/error.js";
import {
	assertNoPunctuation,
	collapseWhitespace,
	lowerCaseFirstCharacter,
	properlyPuncuate,
	removeComments,
	removeTrailingPunctuation,
	unwrapText,
	upperCaseFirstCharacter,
} from "../lib/utils/string.js";
import wrap from "../lib/utils/wrap.js";

const summaryRegex =
	/^(?<type>\w+)(?:\((?<scope>[^()]+)\))?(?<breaking>!)?: (?<description>.+)/;
const footerRegex = /^(?<key>[\w-]+|BREAKING CHANGE): (?<value>.+)/;

const normalizeDescription = (description: string): string => {
	description = collapseWhitespace(description);
	description = lowerCaseFirstCharacter(description);
	description = removeTrailingPunctuation(description);
	return description;
};

const normalizeType = (type: string): string => {
	type = type.toLowerCase();
	return type;
};

const normalizeScope = (scope: string): string => {
	scope = collapseWhitespace(scope);
	scope = scope.toLowerCase();
	return scope;
};

const normalizeBody = (body: string): string => {
	body = body.trim();
	if (body === "") {
		return "";
	}

	// If the user already wrapped their body text, join it back up.
	body = unwrapText(body);
	body = body
		.split("\n")
		.map((paragraph) => {
			paragraph = collapseWhitespace(paragraph);
			paragraph = upperCaseFirstCharacter(paragraph);
			paragraph = properlyPuncuate(paragraph);
			return paragraph;
		})
		.join("\n\n");
	return body;
};

const BREAKING_CHANGE_KEY = "BREAKING CHANGE";

const normalizeBreakingChange = (breakingChanges: string): string => {
	breakingChanges = collapseWhitespace(breakingChanges);
	breakingChanges = lowerCaseFirstCharacter(breakingChanges);
	breakingChanges = removeTrailingPunctuation(breakingChanges);
	assertNoPunctuation(breakingChanges);
	return breakingChanges;
};

const normalizeFooter = (footer: Footer): Footer => {
	// Copy input param so we don't modify it accidentally.
	footer = { ...footer };

	let [firstWord, ...trailingWords] = footer.key.split("-") as [
		string,
		...string[],
	];
	firstWord = upperCaseFirstCharacter(firstWord);
	trailingWords = trailingWords.map(lowerCaseFirstCharacter);
	footer.key = [firstWord, ...trailingWords].join("-");

	footer.value = footer.value.trim();
	footer.value = collapseWhitespace(footer.value);

	return footer;
};

const normalizeFooters = (footers: Footer[]): Footer[] => {
	footers = uniqueBy(footers, (footer) => `${footer.key}: ${footer.value}`);
	footers = footers.map(normalizeFooter);
	return footers;
};

const parseCommitMessageBody = (
	lines: string[],
): { body: string; breakingChanges: string[]; footers: Footer[] } => {
	// Parse the body until we see a line that looks like a footer.
	const bodyLines = [];
	lines = lines.toReversed();
	let line = lines.pop();
	while (line !== undefined) {
		if (line.match(footerRegex)) {
			lines.push(line);
			break;
		}

		bodyLines.push(line);

		line = lines.pop();
	}
	let body = bodyLines.join("\n");
	try {
		body = normalizeBody(body);
	} catch (cause) {
		throw new Error(`commit message body malformed`, {
			cause: normalizeError(cause),
		});
	}

	// Remaining lines must be footers
	let footers: Footer[] = [];
	let additionalFooterLines: string[] = [];
	const appendLinesToLastFooter = () => {
		if (additionalFooterLines.length === 0) {
			return;
		}

		const lastFooter = footers[footers.length - 1];
		if (!lastFooter) {
			throw new Error(
				`found lines that don't look like a footer and don't belong to any other footer: ` +
					`${JSON.stringify(additionalFooterLines.join("\n"))}`,
			);
		}

		for (const additionalLine of additionalFooterLines) {
			lastFooter.value += `\n${additionalLine}`;
		}
		additionalFooterLines = [];
	};
	// Reverse lines since we're no longer using pop() to remove the body lines.
	lines = lines.toReversed();
	for (const line of lines) {
		const match = line.match(footerRegex);
		// We may be on a multiline footer, so continue until we see another
		// footer declared.
		if (!match) {
			additionalFooterLines.push(line);
			continue;
		}

		appendLinesToLastFooter();

		const { key, value } = match.groups as { key: string; value: string };
		footers.push({ key, value });
	}
	appendLinesToLastFooter();

	let breakingChanges = removeElements(
		footers,
		({ key }) => key === BREAKING_CHANGE_KEY || key === "BREAKING-CHANGE",
	).map(({ value }) => value);
	breakingChanges = breakingChanges.map(normalizeBreakingChange);

	footers = normalizeFooters(footers);
	return {
		body,
		breakingChanges,
		footers,
	};
};

const parseCommitMessage = (message: string): CommitMessage => {
	message = removeComments(message);

	const [firstLine, ...lines] = message.split(/\r?\n/) as [
		string,
		...string[],
	];
	const summaryMatch = firstLine.match(summaryRegex);
	if (!summaryMatch) {
		throw new Error(
			"commit message is not in a conventional commit v1.0.0 compliant format (see https://www.conventionalcommits.org/en/v1.0.0/)",
		);
	}

	let {
		type,
		scope = "",
		breaking = "",
		description,
	} = summaryMatch.groups as {
		type: string;
		scope: string | undefined;
		breaking: string | undefined;
		description: string;
	};
	type = normalizeType(type);
	scope = normalizeScope(scope);
	try {
		description = normalizeDescription(description);
	} catch (cause) {
		throw new Error(`commit message description malformed`, {
			cause: normalizeError(cause),
		});
	}

	const { body, breakingChanges, footers } = parseCommitMessageBody(lines);
	const isBreaking = breaking !== "" || breakingChanges.length > 0;

	return {
		type,
		scope,
		isBreaking,
		description,
		body,
		breakingChanges,
		footers,
	};
};

const MAX_LINE_LENGTH = 72;

const serializeCommitMessage = ({
	type,
	scope,
	isBreaking,
	description,
	body,
	breakingChanges,
	footers,
}: CommitMessage): string => {
	const summaryLine = `${type}${scope ? `(${scope})` : ""}${isBreaking ? "!" : ""}: ${description}`;
	if (summaryLine.length > MAX_LINE_LENGTH) {
		throw new Error(
			`commit message summary line exceeds max length of ${MAX_LINE_LENGTH} characters`,
		);
	}
	let result = summaryLine;

	if (body) {
		result += `\n\n${wrap(body, { width: MAX_LINE_LENGTH })}`;
	}

	const breakingChangeLines = breakingChanges.map(
		(breakingChange) => `${BREAKING_CHANGE_KEY}: ${breakingChange}`,
	);
	if (breakingChangeLines.length > 0) {
		const breakingChanges = breakingChangeLines.join("\n");
		result += `\n\n${breakingChanges}`;
	}

	const footerLines = footers.map(({ key, value }) => `${key}: ${value}`);
	if (footerLines.length > 0) {
		result += `\n\n${footerLines.join("\n")}`;
	}

	return result;
};

const main = async (): Promise<void> => {
	const messageFile = process.argv[2];
	assert.ok(messageFile, "expected message file as first parameter");

	const config = await findConfig();

	const userCommitMessage = await fs.readFile(messageFile, "utf-8");
	const commitMessage = parseCommitMessage(userCommitMessage);

	await (async () => config.validateCommitMessage?.(commitMessage))().catch(
		(cause) => {
			throw new Error(
				`user-defined validateCommitMessage(...) rejected commit message`,
				{ cause: normalizeError(cause) },
			);
		},
	);

	// Write back the commit message to normalize spacing and newlines.
	await fs.writeFile(messageFile, serializeCommitMessage(commitMessage));
};

await main()
	.catch(normalizeError)
	.then((error) => {
		if (error) {
			console.error(`⛔ Error: ${formatError(error)}`);
			process.exit(1);
		}
	});
