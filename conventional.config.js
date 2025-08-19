import * as fs from "node:fs/promises";
import { defineConfig } from "@websnacksjs/conventional";

/**
 * @param {import("@websnacksjs/conventional").CommitMessage} message
 * @returns {void}
 */
const validateRepoScopedCommit = (message) => {
	const supportedTypes = ["docs", "chore"];
	if (!supportedTypes.includes(message.type)) {
		throw new Error(
			`${JSON.stringify(message.type)} is not a supported repo-scoped commit type ` +
				`(must be one of ${JSON.stringify(supportedTypes).replaceAll(",", ", ")})`,
		);
	}
};

const packages = await fs.readdir(new URL("./packages", import.meta.url));
const validScopes = ["repo", ...packages];

/**
 * @param {import("@websnacksjs/conventional").CommitMessage} message
 * @returns {void}
 */
const validatePackageScopedCommit = (message) => {
	const supportedTypes = ["feat", "fix", "docs", "test", "chore"];
	if (!supportedTypes.includes(message.type)) {
		throw new Error(
			`${JSON.stringify(message.type)} is not a supported package-scoped commit type ` +
				`(must be one of ${JSON.stringify(supportedTypes).replaceAll(",", ", ")})`,
		);
	}
};

/**
 * @param {string} value
 * @returns {void}
 */
const validateUrl = (value) => {
	try {
		new URL(value);
	} catch {
		const error = new Error(
			`expected valid URL but got ${JSON.stringify(value)}`,
		);
		Error.captureStackTrace(error, validateUrl);
		throw error;
	}
};

/**
 * @param {import("@websnacksjs/conventional").Footer[]} footers
 * @returns void
 */
const validateFooters = (footers) => {
	/** @type {string[]} */
	const unsupportedFooters = [];
	/** @type {{footer: string, reason: Error}[]} */
	const invalidFooters = [];
	for (const { key, value } of footers) {
		try {
			switch (key) {
				case "Merge-request": {
					validateUrl(value);
					break;
				}
				default: {
					unsupportedFooters.push(key);
				}
			}
		} catch (error) {
			if (!(error instanceof Error)) {
				throw new Error(
					`caught unexpected non-error value ${JSON.stringify(error)}`,
				);
			}
			invalidFooters.push({ footer: key, reason: error });
		}
	}

	const errorMessageParts = [];
	if (unsupportedFooters.length > 0) {
		let message = `unspported footers in message:`;
		for (const footer of unsupportedFooters) {
			message += `\n\t- ${footer}`;
		}
		errorMessageParts.push(message);
	}
	if (invalidFooters.length > 0) {
		let message = `invalid footers in message:`;
		for (const { footer, reason } of invalidFooters) {
			message += `\n\t- ${footer}: ${reason.message}`;
		}
		errorMessageParts.push(message);
	}
	if (errorMessageParts.length > 0) {
		const message = errorMessageParts.join("\n\n");
		throw new Error(message);
	}
};

export default defineConfig({
	validateCommitMessage(message) {
		if (!message.scope) {
			throw new Error(
				`missing required scope (use "repo" for monorepo-related commits or "@websnacksjs/:package" for package-specific commits)`,
			);
		}

		if (message.scope === "repo") {
			validateRepoScopedCommit(message);
		} else if (packages.includes(message.scope)) {
			validatePackageScopedCommit(message);
		} else {
			throw new Error(
				[
					`scope ${JSON.stringify(message.scope)} is unsupported`,
					`(try one of ${JSON.stringify(validScopes).replace(",", ", ")})`,
				].join(" "),
			);
		}

		validateFooters(message.footers);
	},
});
