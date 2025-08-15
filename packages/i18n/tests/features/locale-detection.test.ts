import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type I18n from "@websnacksjs/i18n";
import { type Fixtures, withFixture } from "../fixtures.ts";

let i18n: I18n<Fixtures["base"]>;
beforeEach(() => {
	i18n = withFixture("base");
});

describe("when run in a server environment", () => {
	it("throws an error when locale is not specified", async () => {
		await assert.rejects(
			i18n.loadMessages(),
			"unable to auto detect locale in non-browser environment (did you supply a locale argument?)",
		);
	});
});

describe("when run in a browser environment w/ supported locale in <html> lang attrbute", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "document", {
			value: {
				documentElement: {
					lang: "fr",
				},
			} as Document,
		});

		return () => {
			delete (globalThis as { document?: Document }).document;
		};
	});

	it("loads appropriate messages for that auto detected locale", async () => {
		const t = await i18n.loadMessages();
		assert.equal(t("denial"), "Je ne l'ai pas frappée. Je ne l'ai pas.");
	});
});

describe("when run in a browser environment w/ supported locale in Navigator.languages", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "navigator", {
			value: {
				languages: ["de-Latn-DE", "fr-Latn-FR"],
			},
		});

		return () => {
			delete (globalThis as { navigator?: Navigator }).navigator;
		};
	});

	it("loads appropriate messages for that auto detected locale", async () => {
		const t = await i18n.loadMessages();
		assert.equal(t("denial"), "Je ne l'ai pas frappée. Je ne l'ai pas.");
	});
});
