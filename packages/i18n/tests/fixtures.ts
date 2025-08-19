import I18n, { type I18nOptions } from "@websnacksjs/i18n";

export type Fixtures = {
	base: {
		common: typeof import("./fixtures/base/en/common.json");
		drama: typeof import("./fixtures/base/en/drama.json");
	};
};

export const withFixture = <F extends keyof Fixtures>(
	fixture: F,
	overrides: Partial<I18nOptions<Fixtures[F]>> = {},
): I18n<Fixtures[F]> => {
	switch (fixture) {
		case "base": {
			return new I18n<Fixtures["base"]>({
				supportedLocales: ["en", "fr", "fr-Arab"],
				namespaces: ["drama"],
				messagesUrlTemplate: new URL(
					"./fixtures/base/:locale/:namespace.json",
					import.meta.url,
				),
				...(overrides as Partial<I18nOptions<Fixtures["base"]>>),
			});
		}
		default: {
			throw new Error("unreachable");
		}
	}
};
