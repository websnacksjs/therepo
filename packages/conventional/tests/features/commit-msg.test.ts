import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import inspector from "node:inspector";
import os from "node:os";
import path from "node:path";
import {
	after,
	afterEach,
	before,
	beforeEach,
	describe,
	it,
	mock,
} from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { code } from "ts-poet";

const detectInspectorPort = (): string | undefined => {
	let inspectorUrl: URL | string | undefined = inspector.url();
	if (!inspectorUrl) {
		return;
	}
	inspectorUrl = new URL(inspectorUrl);
	return inspectorUrl.port;
};

const runCommand = async (
	messageFile: URL,
	{
		signal,
	}: {
		signal: AbortSignal;
	},
): Promise<{ stderr: string; stdout: string; code: number }> => {
	const binFile = new URL("../../bin/conventional.js", import.meta.url);
	const inspectorPort = detectInspectorPort();
	const command = fork(binFile, ["commit-msg", fileURLToPath(messageFile)], {
		signal,
		stdio: ["ipc", "pipe", "pipe"],
		execArgv:
			inspectorPort != null
				? [
						"--inspect",
						"--inspect-port=0",
						// Ensure that inspector output isn't redirectd to
						// stderr which can mess up our tests that assert on
						// stderr.
						"--inspect-publish-uid=http",
					]
				: [],
	});

	let stderr = "";
	command.stderr?.setEncoding("utf-8");
	command.stderr?.on("data", (chunk) => {
		stderr += chunk;
	});

	let stdout = "";
	command.stdout?.setEncoding("utf-8");
	command.stdout?.on("data", (chunk) => {
		stdout += chunk;
	});

	const code = await new Promise<number>((resolve) => {
		command.once("close", (code) => resolve(code ?? 0));
	});
	stderr = stderr.trim();
	stdout = stdout.trim();
	return {
		stderr,
		stdout,
		code,
	};
};

const previousCwd = process.cwd();
let tempDir: URL;
before(async () => {
	tempDir = await fs
		.mkdtemp(path.join(os.tmpdir(), "websnacks-conventional-"))
		.then(pathToFileURL);
	// Add trailing slash so relative URLs get properly appended.
	tempDir.pathname = `${tempDir.pathname}/`;
	process.chdir(fileURLToPath(tempDir));
});
after(async () => {
	process.chdir(previousCwd);
	await fs.rm(tempDir, { recursive: true, force: true });
});

const mockCommitMessage = async (message: string): Promise<URL> => {
	const messageFile = new URL(`./message-${randomUUID()}`, tempDir);
	await fs.writeFile(messageFile, message, "utf-8");
	return messageFile;
};

afterEach(() => {
	mock.reset();
});

describe("conventional commit-msg ...", () => {
	describe("when commit message is missing conventional commit summary line", () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage("fixes an issue");
		});

		it("produces an appropriate error", async ({ signal }) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 1,
					stderr: [
						"⛔ Error: commit message is not in a conventional commit v1.0.0 compliant format",
						"(see https://www.conventionalcommits.org/en/v1.0.0/)",
					].join(" "),
				},
			);
		});
	});

	describe("when commit message contains only a properly formatted summary line & whitespace", () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				["fix(something): fixes something, I think", "", ""].join("\n"),
			);
		});

		it("outputs properly formatted commit message", async ({ signal }) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 0,
				},
			);
			assert.equal(
				await fs.readFile(messageFile, "utf-8"),
				"fix(something): fixes something, I think",
			);
		});
	});

	describe('when commit message description ends with a comma ","', () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				"fix: resolves issue where things wouldn't work,",
			);
		});

		it("rejects the commit message w/ an appropriate error", async ({
			signal,
		}) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 1,
					stderr: [
						"⛔ Error: commit message description malformed:",
						'ends w/ trailing comma "," (did you include the entire string?)',
					].join(" "),
				},
			);
		});
	});

	describe('when commit message body ends with a comma ","', () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				[
					"fix: resolves issue where things wouldn't work",
					"",
					"This fixes that annoying bug reported last week,",
				].join("\n"),
			);
		});

		it("rejects the commit message w/ an appropriate error", async ({
			signal,
		}) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 1,
					stderr: '⛔ Error: commit message body malformed: ends w/ trailing comma "," (did you include the entire string?)',
				},
			);
		});
	});

	describe("when commit message summary line is longer than 72 characters", () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				[
					"feat(subpackage-a): this adds TONS of new features such as",
					"walking your dog, buying groceries, paying your bills, and",
					"more!",
				].join(" "),
			);
		});

		it("rejects commit message w/ appropriate error message", async ({
			signal,
		}) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 1,
					stderr: "⛔ Error: commit message summary line exceeds max length of 72 characters",
				},
			);
		});
	});

	describe("when commit message contains comments", () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				[
					"feat(subpackage-a): added lots of new features",
					"",
					"This adds a LOT of new features. Like, an incredible amount!",
					"",
					"# Please enter the commit message for your changes. Lines starting",
					"# with '#' will be ignored, and an empty message aborts the commit.",
					"#",
					"# Date:      Mon Aug 18 16:24:29 2025 +0000",
				].join("\n"),
			);
		});

		it("removes comments from the comment message", async ({ signal }) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 0,
					stderr: "",
				},
			);
			assert.equal(
				await fs.readFile(messageFile, "utf-8"),
				[
					"feat(subpackage-a): added lots of new features",
					"",
					"This adds a LOT of new features. Like, an incredible amount!",
				].join("\n"),
			);
		});
	});

	describe("when commit message is valid conventional commit but is improperly formatted", () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				[
					"feat(  subpackage-a ):     added   lots of new features",
					"adds a lot of neat stuff",
					"",
					"you should    check it out brah!",
					"",
					"BREAKING-CHANGE: It's gonna break production, gurranteed.",
					"",
					"",
					"authored-By: Someone",
					"     ",
				].join("\n"),
			);
		});

		it("formats commit message to normalize whitespace, capitalization & punctuation", async ({
			signal,
		}) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 0,
					stderr: "",
				},
			);
			assert.equal(
				await fs.readFile(messageFile, "utf-8"),
				[
					"feat(subpackage-a)!: added lots of new features",
					"",
					"Adds a lot of neat stuff.",
					"",
					"You should check it out brah!",
					"",
					"BREAKING CHANGE: it's gonna break production, gurranteed",
					"",
					"Authored-by: Someone",
				].join("\n"),
			);
		});
	});

	describe("when commit message body exceeds max line length of 72 characters", () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				[
					"feat(subpackage-a): added lots of new features",
					"",
					[
						"Lorem ipsum dolor sit amet, consectetur adipiscing",
						"elit, sed do eiusmod tempor incididunt ut labore et",
						"dolore magna aliqua. Ut enim ad minim veniam, quis",
						"https://example.com/some/very/very/very/very/long-path/with-hyphens.html",
						"nostrud exercitation ullamco laboris nisi ut aliquip",
						"ex ea commodo consequat.",
					].join(" "),
					"",
					"",
				].join("\n"),
			);
		});

		it("wraps message body at 72 character rule where feasible", async ({
			signal,
		}) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 0,
				},
			);
			assert.equal(
				await fs.readFile(messageFile, "utf-8"),
				[
					"feat(subpackage-a): added lots of new features",
					"",
					"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod",
					"tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim",
					"veniam, quis",
					"https://example.com/some/very/very/very/very/long-path/with-hyphens.html",
					"nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo",
					"consequat.",
				].join("\n"),
			);
		});
	});

	describe('when commit message has "BREAKING CHANGE" footer', () => {
		let messageFile: URL;
		beforeEach(async () => {
			messageFile = await mockCommitMessage(
				[
					"fix(@websnacksjs/conventional): changes a few things",
					"",
					"BREAKING CHANGE: this will break production, guaranteed",
				].join("\n"),
			);
		});

		it("marks commit message summary as breaking", async ({ signal }) => {
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 0,
					stderr: "",
				},
			);
			const [firstLine] = await fs
				.readFile(messageFile, "utf-8")
				.then((message) => message.split("\n"));
			assert.equal(
				firstLine,
				"fix(@websnacksjs/conventional)!: changes a few things",
			);
		});
	});

	describe("when user provides a config file that fails to load", () => {
		let configFile: URL;
		before(async () => {
			configFile = new URL("./conventional.config.js", tempDir);
			await fs.writeFile(
				configFile,
				code`
					export default =
				`.toString(),
				"utf-8",
			);
		});
		after(async () => {
			await fs.rm(configFile);
		});

		it("provides an appropriate error message", async ({ signal }) => {
			const messageFile = await mockCommitMessage(
				["feat(good): this is a good thing, probably"].join("\n"),
			);
			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 1,
					stderr: [
						`⛔ Error: failed to load config from ./conventional.config.js:`,
						`Unexpected token '='`,
					].join(" "),
				},
			);
		});
	});

	describe("when user provides config file w/ validateCommitMessage(...)", () => {
		let configFile: URL;
		before(async () => {
			configFile = new URL("./conventional.config.js", tempDir);
			await fs.writeFile(
				configFile,
				code`
					export default {
						validateCommitMessage(message) {
							if (message.scope !== "good") {
								throw new Error(\`only "good" is accepted as a valid scope\`)
							}
						}
					};
				`.toString(),
				"utf-8",
			);
		});
		after(async () => {
			await fs.rm(configFile);
		});

		it("rejects commit message that DON'T satisfy user validation function", async ({
			signal,
		}) => {
			const messageFile = await mockCommitMessage(
				"feat(bad): adds a terrible new feature, beware",
			);

			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 1,
					stderr: [
						`⛔ Error: user-defined validateCommitMessage(...) rejected commit message:`,
						`only "good" is accepted as a valid scope`,
					].join(" "),
				},
			);
		});

		it("approves commit message that DO satisfy user validation function", async ({
			signal,
		}) => {
			const messageFile = await mockCommitMessage(
				"feat(good): adds a terrible new feature, beware",
			);

			assert.partialDeepStrictEqual(
				await runCommand(messageFile, { signal }),
				{
					code: 0,
					stdout: "",
				},
			);
		});
	});
});
