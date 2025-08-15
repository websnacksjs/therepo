import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type I18n from "@websnacksjs/i18n";
import { type Fixtures, withFixture } from "../fixtures.ts";

describe("new I18n(...)", () => {
	it("throws error when passed messageUrlTemplate w/o :locale, :namespace placeholders", () => {
		assert.throws(
			() =>
				withFixture("base", {
					messagesUrlTemplate: new URL(
						"../some/path",
						import.meta.url,
					),
				}),
			{
				message:
					'messagesUrlTemplate is missing required placeholders [":locale", ":namespace"]',
			},
		);

		assert.throws(
			() =>
				withFixture("base", {
					messagesUrlTemplate: new URL(
						"../some/path/:namespace",
						import.meta.url,
					),
				}),
			{
				message:
					'messagesUrlTemplate is missing required placeholders [":locale"]',
			},
		);
	});

	it("throws error when passed empty array of supportedLocales", () => {
		assert.throws(
			() =>
				withFixture("base", {
					supportedLocales: [],
				}),
			{
				message:
					"supportedLocales is empty and no locales would be supported",
			},
		);
	});

	it("throws error when passed locale strings that don't conform to RFC 5646", () => {
		const invalidLocales = ["en_US", "zh-CN-UTF-8", "en-GB@euro"];
		assert.throws(
			() =>
				withFixture("base", {
					supportedLocales: ["fr-Latn-FR", ...invalidLocales],
				}),
			{
				message: `supportedLocales contains invalid RFC 5646 locale strings ["en_US","zh-CN-UTF-8","en-GB@euro"]`,
			},
		);
	});
});

describe("i18n.loadMessages(...)", () => {
	let i18n: I18n<Fixtures["base"]>;
	beforeEach(() => {
		i18n = withFixture("base");
	});

	it("throws error when requesting namespaces that weren't declared", async () => {
		await assert.rejects(
			i18n.loadMessages({
				locale: "en",
				// @ts-ignore
				namespaces: ["doesnt-exist", "neither-does-this"],
			}),
			{
				message:
					'attempted to load messages from undeclared namespaces ["doesnt-exist", "neither-does-this"] ' +
					"(did you declare them in the I18n constructor?)",
			},
		);
	});

	it("throws error when requesting locales that weren't declared", async () => {
		await assert.rejects(
			i18n.loadMessages({
				locale: "de",
				namespaces: ["drama"],
			}),
			{
				message:
					'no declared locale matches requested locale of "de-Latn-DE" (maximized from "de")',
			},
		);
	});
});

describe("t(...)", () => {
	let i18n: I18n<Fixtures["base"]>;
	beforeEach(() => {
		i18n = withFixture("base");
	});

	it("correctly translates common messages", async () => {
		const t = await i18n.loadMessages({ locale: "fr" });
		assert.equal(t("denial"), "Je ne l'ai pas frappée. Je ne l'ai pas.");
	});

	it("correctly substitutes placeholders in translations", async () => {
		const t = await i18n.loadMessages({ locale: "fr" });
		assert.equal(t("oh hai", { name: "Mark" }), "Oh salut, Mark !");
	});

	it("correctly translates messages with nested keys", async () => {
		const t = await i18n.loadMessages({ locale: "fr" });
		assert.equal(t("flower shop.doggy"), "Salut toutou !");
	});

	it("correctly translates namespaced messages", async () => {
		const t = await i18n.loadMessages({
			locale: "fr",
			namespaces: ["drama"],
		});
		assert.equal(t("drama:tearing me apart"), "Tu me déchires, Lisa !");
	});
});
