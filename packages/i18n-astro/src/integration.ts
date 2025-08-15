import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { AstroIntegration } from "astro";
import { type Code, code, literalOf } from "ts-poet";
import runtimeVirtualModule from "./virtual-modules/runtime.js";

export type I18nAstroOptions = {
	baseLocale: string;
	messagesDir?: URL | string;
};

const messagesUrlPrefix = "messages";

export default function i18n({
	baseLocale,
	// TODO: optimize for when messages are in public folder
	messagesDir = "./messages",
}: I18nAstroOptions): AstroIntegration {
	let baseLocaleDir: URL;
	const namespaces: string[] = [];
	let supportedLocales: string[];
	let runtimeModuleId: string;
	return {
		name: "@websnacksjs/i18n-astro",
		hooks: {
			async "astro:config:setup"({ config, updateConfig }) {
				messagesDir = new URL(`${messagesDir}/`, config.root);
				supportedLocales = await fs
					.readdir(messagesDir)
					.catch((cause) => {
						if (
							(cause as NodeJS.ErrnoException).code === "ENOENT"
						) {
							throw new Error(
								`localized messages directory ${(messagesDir as URL).pathname} does not exist (did you specify the right path in messagesDir option?)`,
							);
						}

						throw new Error(
							`failed to read localized messages from directory ${(messagesDir as URL).pathname}: ${cause.message ?? JSON.stringify(cause)}}`,
							{ cause },
						);
					});
				if (!supportedLocales.includes(baseLocale)) {
					throw new Error(
						`baseLocale ${JSON.stringify(baseLocale)} does not exist in messagesDir ${JSON.stringify(messagesDir.pathname)}`,
					);
				}

				baseLocaleDir = new URL(`./${baseLocale}/`, messagesDir);
				for await (const fileName of fs.glob("*.json", {
					cwd: baseLocaleDir.pathname,
				})) {
					const namespace = path.basename(fileName, ".json");
					if (namespace !== "common") {
						namespaces.push(namespace);
					}
				}

				const runtimeModule = runtimeVirtualModule({
					namespaces,
					supportedLocales,
					messagesDir,
					messagesUrlPrefix,
				});
				runtimeModuleId = runtimeModule.moduleId;
				updateConfig({
					vite: {
						plugins: [runtimeModule.plugin],
					},
				});
			},
			async "astro:server:setup"({ server }) {
				server.middlewares.use((req, res, next) => {
					if (!req.url?.startsWith(messagesUrlPrefix)) {
						return next();
					}

					const relPath = req.url.slice(messagesUrlPrefix.length);
					const filePath = new URL(`./${relPath}`, messagesDir);
					createReadStream(filePath)
						.once("error", (err) => {
							if (
								(err as NodeJS.ErrnoException).code === "ENOENT"
							) {
								res.statusCode = 404;
								res.end();
							} else {
								res.statusCode = 500;
								res.end();
							}
						})
						.once("open", () => {
							res.writeHead(200);
						})
						.pipe(res);
				});
			},
			async "astro:build:done"({ dir }) {
				const messageAssetsDir = new URL(`./${messagesUrlPrefix}`, dir);
				await fs.cp(messagesDir, messageAssetsDir);
			},
			async "astro:config:done"({ injectTypes }) {
				const commonMessagesFile = new URL(
					"./common.json",
					baseLocaleDir,
				);
				injectTypes({
					filename: "types.d.ts",
					content: code`
						declare module "${runtimeModuleId}" {
							import type I18n from "@websnacksjs/i18n";
							const i18n: I18n<{
								common: typeof import(${literalOf(commonMessagesFile.pathname)});
							} & ${namespaces.reduce(
								(acc, ns) => {
									const file = new URL(
										`./${ns}.json`,
										baseLocaleDir,
									);
									acc[ns] =
										code`typeof import(${literalOf(file.pathname)})`;
									return acc;
								},
								{} as Record<string, Code>,
							)}>;
							export default i18n;
						}
					`.toString(),
				});
			},
		},
	};
}
