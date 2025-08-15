import { isDictionary, lookupValue } from "./utils/dictionary.js";
import { isValidRfc5646Locale, maximizeLocale } from "./utils/locales.js";
import type {
	NamespacedMessages,
	NamespacesOf,
	NamespacesSubset,
	TFunction,
} from "./utils/types.js";

export type I18nOptions<Messages extends NamespacedMessages> = {
	supportedLocales: string[];
	namespaces?: NamespacesOf<Messages>[];
	messagesUrlTemplate?: URL;
};

type LoadMessagesOptions<
	Messages extends NamespacedMessages,
	NS extends NamespacesOf<Messages>,
> = {
	locale?: string;
	namespaces?: NS[];
};

const guessMessagesUrlPatternFromEnv = (): URL => {
	if (typeof window !== "undefined") {
		return new URL("/messages/:locale/:namespace.json", import.meta.url);
	}

	if (typeof process !== "undefined") {
		return new URL(
			"./messages/:locale/:namespaces.json",
			`file://${process.cwd()}`,
		);
	}

	if (typeof Deno !== "undefined") {
		return new URL(
			"./messages/:locale/:namespaces.json",
			`file://${Deno.cwd()}`,
		);
	}

	throw new Error(
		`unable to determine current runtime environment (try supplying sourceUrl param manually instead)`,
	);
};

const validateSupportedLocales = (supportedLocales: string[]): void => {
	if (supportedLocales.length === 0) {
		throw new Error(
			`supportedLocales is empty and no locales would be supported`,
		);
	}

	const invalidLocales = supportedLocales.filter(
		(locale) => !isValidRfc5646Locale(locale),
	);
	if (invalidLocales.length > 0) {
		throw new Error(
			`supportedLocales contains invalid RFC 5646 locale strings ${JSON.stringify(invalidLocales)}`,
		);
	}
};

const validateMessagesUrlTemplate = (messagesUrlTemplate: URL): void => {
	const missingPlaceholders = [":locale", ":namespace"].filter(
		(placeholder) => !messagesUrlTemplate.toString().includes(placeholder),
	);
	if (missingPlaceholders.length > 0) {
		throw new Error(
			`messagesUrlTemplate is missing required placeholders ${JSON.stringify(missingPlaceholders).replace(",", ", ")}`,
		);
	}
};

const substitutePlaceholders = (
	message: string,
	substitutions: Record<string, string>,
): string => {
	return message.replaceAll(/{{(.+)}}/g, (_, placeholder) => {
		if (!substitutions?.[placeholder]) {
			throw new Error(
				`missing required substitution for placeholder {{${placeholder}}}`,
			);
		}
		return substitutions[placeholder];
	});
};

class I18n<Messages extends NamespacedMessages> {
	#supportedLocales: Record<string, { declaredAs: string }>;
	#namespaces: Set<NamespacesOf<Messages>>;
	#loadedMessages: Record<string, Partial<Messages>>;
	#messagesUrlTemplate: URL;

	#normalizeLocale(locale: string): string {
		if (!isValidRfc5646Locale(locale)) {
			throw new Error(
				`locale ${JSON.stringify(locale)} is NOT a valid RFC 5646 locale string`,
			);
		}

		const maximizedLocale = maximizeLocale(locale);
		if (!(maximizedLocale in this.#supportedLocales)) {
			throw new Error(
				`no declared locale matches requested locale of ${JSON.stringify(
					maximizedLocale,
				)} (maximized from ${JSON.stringify(locale)})`,
			);
		}

		return maximizedLocale;
	}

	#validateNamespaces(namespaces: string[]): void {
		const undeclaredNamespaces = Array.from(
			new Set(namespaces).difference(this.#namespaces),
		);
		if (undeclaredNamespaces.length > 0) {
			throw new Error(
				`attempted to load messages from undeclared namespaces ${JSON.stringify(undeclaredNamespaces).replaceAll(",", ", ")} (did you declare them in the I18n constructor?)`,
			);
		}
	}

	#detectLocale(): string {
		if (typeof document === "undefined") {
			throw new Error(
				`attempted to detect locale in non-browser environment`,
			);
		}

		const { lang } = document.documentElement;
		if (this.isSupportedLocale(lang)) {
			return maximizeLocale(lang);
		}

		const [locale] = navigator.languages.filter(this.isSupportedLocale);
		if (locale) {
			return maximizeLocale(locale);
		}

		throw new Error(
			`no supported locale detected in <html lang="..."> attribute (found lang=${JSON.stringify(lang)})` +
				` or navigator.languages (found navigator.languages=${JSON.stringify(navigator.languages)})`,
		);
	}

	async #fetchMessages<NS extends keyof Messages>(
		locale: string,
		declaredAs: string,
		namespace: NS,
	): Promise<Messages[NS]> {
		const cachedMessages = this.#loadedMessages[locale];
		if (cachedMessages?.[namespace]) {
			return cachedMessages[namespace];
		}

		const sourceUrl = new URL(this.#messagesUrlTemplate);
		sourceUrl.pathname = sourceUrl.pathname
			.replaceAll(":locale", declaredAs)
			.replaceAll(":namespace", namespace as string);

		let messages: unknown;
		switch (sourceUrl.protocol) {
			case "file:": {
				const fs = await import("node:fs/promises");
				messages = await fs
					.readFile(sourceUrl, { encoding: "utf-8" })
					.then(JSON.parse);
				break;
			}
			default: {
				// Let fetch handle all other protocols for broader interoperability.
				const res = await fetch(sourceUrl);
				if (!res.ok) {
					throw new Error(`bad response (status code ${res.status})`);
				}
				messages = await res.json();
			}
		}

		if (!isDictionary(messages)) {
			throw new Error(
				`malformed messages received from ${sourceUrl} (expected an object but got ${JSON.stringify(messages)})`,
			);
		}

		// biome-ignore lint/style/noNonNullAssertion: Loaded messages will always be defined and enforced by the constructor.
		this.#loadedMessages[locale]![namespace] = messages as Messages[NS];
		return messages as Messages[NS];
	}

	async #loadMessages<NS extends NamespacesOf<Messages>>(
		locale: string,
		namespaces: NS[] = [],
	): Promise<NamespacesSubset<Messages, NS>> {
		const maximizedLocale = maximizeLocale(locale);
		const { declaredAs } = this.#supportedLocales[maximizedLocale] ?? {};
		if (!declaredAs) {
			throw new Error(
				`no declared locale matches requested locale of ${JSON.stringify(maximizedLocale)} (maximized from ${locale})`,
			);
		}

		return Object.fromEntries(
			await Promise.all(
				[...namespaces, "common" as const].map(async (namespace) => {
					return [
						namespace,
						await this.#fetchMessages(
							maximizedLocale,
							declaredAs,
							namespace,
						).catch((cause) => {
							throw new Error(
								`failed to load messages: ${cause.message ?? JSON.stringify(cause)}`,
								{
									cause,
								},
							);
						}),
					];
				}),
			),
		);
	}

	constructor({
		supportedLocales,
		namespaces = [],
		messagesUrlTemplate,
	}: I18nOptions<Messages>) {
		validateSupportedLocales(supportedLocales);
		this.#supportedLocales = Object.fromEntries(
			supportedLocales.map(
				(locale) =>
					[maximizeLocale(locale), { declaredAs: locale }] as const,
			),
		);

		this.#namespaces = new Set(namespaces);

		this.#loadedMessages = Object.fromEntries(
			Object.keys(this.#supportedLocales).map(
				(locale) => [locale, {}] as const,
			),
		);

		messagesUrlTemplate ??= guessMessagesUrlPatternFromEnv();
		validateMessagesUrlTemplate(messagesUrlTemplate);
		this.#messagesUrlTemplate = messagesUrlTemplate;
	}

	supportedLocales(): string[] {
		return Object.keys(this.#supportedLocales);
	}

	isSupportedLocale(value: string): boolean {
		return maximizeLocale(value) in this.#supportedLocales;
	}

	#parseKey<NS extends NamespacesOf<Messages>>(
		key: string,
		namespaces: NS[],
	): { namespace: NS | "common"; selector: string } {
		const { namespace = "common", selector } =
			key.match(/^((?<namespace>[a-z]+):)?(?<selector>.*)/i)?.groups ||
			{};

		if (!selector) {
			throw new Error(
				`received malformed key ${JSON.stringify(key)} (must be in the format "[namespace:]key{.nested}")`,
			);
		}

		const isValidNamespace = (ns: string): ns is NS =>
			ns === "common" || namespaces.includes(ns as NS);
		if (!isValidNamespace(namespace)) {
			throw new Error(
				`parsed namespace of key ${JSON.stringify(key)} (${JSON.stringify(namespace)}) was not in declared namespaces (did you declare it in the call to i18n.loadMessages(...)?)`,
			);
		}
		return { namespace, selector };
	}

	async loadMessages<NS extends NamespacesOf<Messages>>({
		locale,
		namespaces = [],
	}: LoadMessagesOptions<Messages, NS> = {}): Promise<
		TFunction<Messages, NS>
	> {
		this.#validateNamespaces(namespaces);
		locale = this.#normalizeLocale(locale ?? this.#detectLocale());

		const messages = await this.#loadMessages(locale, namespaces);

		const t: TFunction<Messages, NS> = (key, substitutions = {}) => {
			const { namespace, selector } = this.#parseKey(key, namespaces);

			if (!messages[namespace]) {
				throw new Error(
					`no messages were loaded for namespace ${JSON.stringify(namespace)} (this is an internal error and should never happen)`,
				);
			}

			let message = lookupValue(
				messages[namespace],
				// biome-ignore lint/suspicious/noExplicitAny: Probably not worth the hastle of strictly typing this key since it's already handled by loadMessages itself.
				selector as any,
			) as string;
			if (!message) {
				throw new Error(
					`message for namespace ${JSON.stringify(namespace)} at ${JSON.stringify(selector)} not found (is there a typo in the key selector?)`,
				);
			}

			message = substitutePlaceholders(message, substitutions);

			return message as string;
		};
		t.locale = () => locale;

		return t;
	}
}

export default I18n;
