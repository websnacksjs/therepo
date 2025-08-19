import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommitMessage } from "./types.js";
import { normalizeError } from "./utils/error.js";

export type ConventionalConfig = {
	validateCommitMessage?(message: CommitMessage): void | Promise<void>;
};

export type ConventionalUserConfig = Partial<ConventionalConfig>;

export const defineConfig = (
	config: ConventionalUserConfig,
): ConventionalUserConfig => config;

function validateConfig(
	value: unknown,
): asserts value is ConventionalUserConfig {
	if (typeof value !== "object") {
		throw new Error(`not an object`);
	}

	if (value === null) {
		throw new Error(`is null`);
	}

	if (
		"validateCommitMessage" in value &&
		typeof value.validateCommitMessage !== "function"
	) {
		throw new Error(`validateCommitMessage is not a function`);
	}
}

const isErrnoException = (value: unknown): value is NodeJS.ErrnoException => {
	if (!(value instanceof Error)) {
		return false;
	}

	if ("errno" in value && typeof value.errno !== "number") {
		return false;
	}

	if ("code" in value && typeof value.code !== "string") {
		return false;
	}

	if ("path" in value && typeof value.path !== "string") {
		return false;
	}

	if ("syscall" in value && typeof value.syscall !== "string") {
		return false;
	}

	return true;
};

const DEFAULT_CONFIG: ConventionalUserConfig = {};

export const findConfig = async (): Promise<ConventionalConfig> => {
	const configDir = new URL(`file://${process.cwd()}/`);
	do {
		const configFile = new URL("./conventional.config.js", configDir);
		try {
			await fs.stat(configFile);
		} catch (error) {
			if (!isErrnoException(error) || error.code !== "ENOENT") {
				throw error;
			}

			configDir.pathname = `${configDir.pathname.split("/").slice(0, -2).join("/")}/`;
			continue;
		}
		const config = await import(configFile.toString())
			.then((mod: object) => {
				if (!("default" in mod)) {
					throw new Error(
						`no default export in ${fileURLToPath(configFile)}`,
					);
				}
				return mod.default;
			})
			.catch((cause) => {
				const relativeConfigFile = path.relative(
					process.cwd(),
					fileURLToPath(configFile),
				);
				throw new Error(
					`failed to load config from ./${relativeConfigFile}`,
					{
						cause: normalizeError(cause),
					},
				);
			});
		validateConfig(config);
		return config;
	} while (configDir.pathname !== "/");

	return DEFAULT_CONFIG;
};
