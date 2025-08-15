import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type I18n from "@websnacksjs/i18n";
import { type Fixtures, withFixture } from "../fixtures.js";

describe("i18n.supportedLocales()", () => {
	let i18n: I18n<Fixtures["base"]>;
	beforeEach(() => {
		i18n = withFixture("base", {
			supportedLocales: ["en", "fr", "fr-Arab"],
		});
	});

	it("returns maximized locales for all declared, supported locales", () => {
		assert.deepEqual(i18n.supportedLocales(), [
			"en-Latn-US",
			"fr-Latn-FR",
			"fr-Arab-FR",
		]);
	});
});

describe("i18n.loadMessages(...)", () => {
	let i18n: I18n<Fixtures["base"]>;
	beforeEach(() => {
		i18n = withFixture("base");
	});

	it("guesses region of locales w/o region tags", async () => {
		const t = await i18n.loadMessages({
			locale: "fr-Latn",
		});
		assert.equal(t.locale(), "fr-Latn-FR");
	});

	it("guesses script of locales w/ region tags", async () => {
		const t = await i18n.loadMessages({
			locale: "fr-FR",
		});
		assert.equal(t.locale(), "fr-Latn-FR");
	});

	it("guesses script & region of bare language locales", async () => {
		const t = await i18n.loadMessages({
			locale: "fr",
		});
		assert.equal(t.locale(), "fr-Latn-FR");
	});

	it("does NOT fallback to bare language locales", async () => {
		await assert.rejects(
			i18n.loadMessages({
				locale: "en-Arab",
			}),
			{
				message:
					'no declared locale matches requested locale of "en-Arab-US" (maximized from "en-Arab")',
			},
		);
	});
});
