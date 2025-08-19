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

const packagePrefix = "@websnacksjs/";
const packages = await fs.readdir(new URL("./packages", import.meta.url));

/**
 * @param {import("@websnacksjs/conventional").CommitMessage} message
 * @returns {void}
 */
const validatePackageScopedCommit = (message) => {
	const pkg = message.scope?.slice(packagePrefix.length) ?? "";
	if (!packages.includes(pkg)) {
		throw new Error(
			`unknown package ${JSON.stringify(pkg)} referenced in commit scope`,
		);
	}

	const supportedTypes = ["feat", "fix", "docs", "test", "chore"];
	if (!supportedTypes.includes(message.type)) {
		throw new Error(
			`${JSON.stringify(message.type)} is not a supported package-scoped commit type ` +
				`(must be one of ${JSON.stringify(supportedTypes).replaceAll(",", ", ")})`,
		);
	}
};

export default defineConfig({
	validateCommitMessage(message) {
		if (!message.scope) {
			throw new Error(
				`missing required scope (use "repo" for monorepo-related commits or "@websnacksjs/:package" for package-specific commits)`,
			);
		}

		if (message.footers.length > 0) {
			throw new Error(
				`commit message footers are currently unsupported ` +
					`(try removing them from your commit message)`,
			);
		}

		if (message.scope === "repo") {
			validateRepoScopedCommit(message);
			return;
		}

		if (message.scope.startsWith(packagePrefix)) {
			validatePackageScopedCommit(message);
			return;
		}

		throw new Error(
			`scope ${JSON.stringify(message.scope)} is unsupported (try one of ["repo", "@websnacksjs/:package"])`,
		);
	},
});
