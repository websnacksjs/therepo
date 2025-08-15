# @websnacksjs/i18n

A lightweight, zero-dependency, isomorphic internationalization (i18n) library for modern build pipelines.

Designed as a simpler alternative to [`i18next`](https://www.i18next.com/) with a fail-fast and convention-over-configuration philosophy.

## ✨ Features

- **🛡️ Type-safe** – Catch typos and missing translation keys at build time with strongly-typed keys.
- **🚫 Fails-fast** – Ensure your team catches translation issues *before* they impact end users.
- **📦 Zero runtime dependencies** – Nothing extra to ship or transitive dependencies to monitor for security vulnerabilities.
- **🪶 Simple & standards-compliant** – Intuitive & highly interoperable with browser & node Intl APIs.

## 📦 Installation

```bash
npm install @websnacksjs/i18n
# or
yarn add @websnacksjs/i18n
# or
pnpm add @websnacksjs/i18n
```

## 🚀 Quick Start

**`./messages/en/common.json`**

```json
{
  "hello": "Hello, {{name}}!"
}
```

---

**`./messages/fr-Arab/common.json`**

```json
{
  "hello": "بونجور \u2066{{name}}\u2069!"
}
```

---

```ts
import I18n from "@websnacksjs/i18n";

const i18n = new I18n<{
 common: typeof import("./messages/en/common.json")
}>({
  supportedLocales: ["en", "fr-Arab"],
});

const t_en = await i18n.loadMessages({ locale: "en-US" });
// Picks the "en" locale messages, since "en-US" and "en" both maximize to "en-Latn-US" and have the same script.
console.log(t_en("hello", { name: "Alice" }));
// Prints "Hello, Alice!"

const t_frArab = await i18n.loadMessages({ locale: "fr-Arab" });
console.log(t_frArab("hello", { name: "Alice" }));
// Prints "بونجور\u2066Alice\u2069!"

const t_fr = await i18n.loadMessages({ locale: "fr" });
// Throws error, since "fr" maximizes to "fr-Latn-FR" and no declared locales support Latin script in the French language.
```

## 📖 Usage Details

### 🗂 Message Structure

By convention, localized messages are stored under a common `messages/` folder at the root of your project, with each locale stored under a nested folder named after the locale and common/namespaced messages stored in `.json` files under each locale folder.

For example, in a project that supports the "en" and "fr" locales and has localization messages under both a "common" and a "homepage" namespace, by default `@websnacksjs/i18n` expects to find the following directory structure:

```plaintext
messages/
  ├── en/
  │   ├── common.json
  │   └── homepage.json
  └──fr/
      ├── common.json
      └── homepage.json
```

`@websnacksjs/i18n` uses URL templates with `:locale` and `:namespace` placeholders to specify how to load messages given a particular locale and set of namespace files. By default, it uses the following message URL templates depending upon the runtime environment:

- Server (node, Deno, etc.): `file://${process.cwd()}/messages/:locale/:namespace.json`
- Browser: `///messages/:locale/:namespace.json`

You can change this default behavior using the `messagesUrlTemplate` argment in `I18n`'s constructor. For example, to tell `@websnacksjs/i18n` to fetch messages from your translation service at "<https://translations.example.com/messages>" without a ".json" extension:

```ts
import I18n from "@websnacksjs/i18n";

const i18n = new I18n({
 supportedLocales: ["en", "fr-Arab"],
 messagesUrlTemplate: "https://translations.example.com/messages/:locale/:namespace",
});
```

### 📄 Namespaces

`@websnacksjs/i18n` requires a common messages file that is always loaded when `i18n.loadMessages(...)` is called. As your application grows and you gather more and more locationalized messages, you may find some performance advantages to splitting up those messages into separate files that are only loaded for particular parts of your application (you should **test** this before commiting to this approach, as it adds some complexity and the performance benefit may be minor).

To use namespaces, simply store your namespaced messages files in a `{namespace}.json` file next to your `common.json` messsages file, replacing `{namespace}` with a short, readable name for your namespace. To load and use these namespaced message files, declare them in the `I18n` constructor and provide a `namespaces` parameter to `i18n.loadMessages(...)`. Note that namespaced keys must be prefixed by "{namespace}:" (this is enforced at compile time, see TypeScript integration below):

**`./messages/en/common.json`**

```json
{
 "hello": "Hello {{name}}!"
}
```

**`./messages/en/homepage.json`**

```json
{
 "search catalog": "Search our catalog"
}
```

```ts
import I18n from "@websnacksjs/i18n";

const i18n = new I18n<{
 common: typeof import("./messages/en/common.json"),
 homepage: typeof import("./messages/en/homepage.json"),
}>({
 supportedLocales: ["en", "fr"],
 namespaces: ["homepage"],
});
const t = await i18n.loadMessages({ locale: "en", namespaces: ["homepage"] });
console.log(t("homepage:search catalog"));
// Prints "Search our catalog"
```

### 🪄 Locale Autodetection in Browsers

In the browser, the `locale` paramter of `i18n.loadMessages(...)` may be omitted to enable autodetection of the current user's locale. Autodetection works by first checking to see if the `<html>` tag has a valid `lang` attribute, and falls back to using [`navigator.languages`](developer.mozilla.org/en-US/docs/Web/API/Navigator/languages) if `<html lang="...">` isn't present or valid.

### 🛡 TypeScript Integration & Type-Safe Keys

`@websnacksjs/i18n` supports strongly typed keys in TypeScript, turning typos into compile-time errors instead of poor experiences for end users. Strongly typed keys are automatically enabled with integration plugins such as `@websnacksjs/i18n-astro`, but if you're using a different framework or want to configure things manually you can leverage TypeScript's `resolveJsonModule` compiler option to inform the `I18n` class of the shape of your message files:

**`./messages/en/common.json`**

```json
{
 "hello": "Hello {{name}}!"
}
```

```ts
import I18n from '@websnacksjs/i18n';

const i18n = new I18n<{
 common: typeof import("./messages/en/common.json"),
}>({
 supportedLocales: ["en", "fr"],
});
const t = await i18n.loadMessages({ locale: "en" });
console.log(t("welcome", { name: "Alice" }));
// Fails to compile: "welcome" is not a valid messages key.
```

If your translation files are not stored locally, you'll need to produce an appropriate TypeScript type from your source messages and pass that to `I18n`'s constructor as a generic parameter.

Note that at present, messages with placeholders are not strongly typed and substitutions are not enforced by the compiler due to [TypeScript issue #32063](https://github.com/microsoft/TypeScript/issues/32063). Some type generation magic in integration libraries (e.g. `@websnacksjs/i18n-astro`) could provide a workaround, but such type generation has yet to be implemented. This means that the following code will compile but result in a runtime error:

```ts
import I18n from '@websnacksjs/i18n';

const i18n = new I18n({
 supportedLocales: ["en"],
});
const t = i18n.loadMessages({ locale: "en" });
console.log(t("hello"));
// Compiles, but throws an error at runtime: missing substitution for placeholder "{{name}}"

```

### 🌍 Standards Compliance & Locale Fallback

Only [RFC 5646](https://www.rfc-editor.org/rfc/rfc5646)-compliant locale strings are supported in `@websnacksjs/i18n` to enable interoperability with standard libraries like [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl).

Enforcement of RFC 5646 in `@websnacksjs/i18n` also allows for zero-configuration locale fallback using [Unicode CLDR's "Add Likely Subtags"](https://unicode.org/reports/tr35/) alogorithm, where the region and/or script subtags of an abmiguous locale like "fr" can be inferred or "maximized" to "fr-Latn-FR". This allows `@websnacksjs/i18n` to make intelligent, safe fallback decisions, such as falling back to the "fr" locale (with latin script) when given an amgiuous locale like "fr-FR".

Note that in practice only fallbacks to locales that maximize to the same script and language are supported. A locale like "fr-Arab-MT" will NOT fallback to "fr" (maximized to "fr-Latn-FR") because that would result in a different script that end users may or may not be able to read.

## 🆚 Why @websnacksjs/i18n Instead of i18next?

| Feature                   | i18next                               | @websnacksjs/i18n                                              |
| ------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Missing key behavior      | &#x1F922; Outputs raw key             | &#x1F6D1; Fails at build/runtime w/ Error            |
| Missing locale behavior   | &#x1F922; Render fallback locale      | &#x1F6D1; Fails at build/runtime w/ Error            |
| Type-safe keys            | &#x1F527; Requires configuration      | &#x02728; Automatic (w/ astro integration)           |
| Setup Complexity          | &#x1F527; Config-driven               | &#x02728; Convention over configuration              |

## 📜 License

`@websnacksjs/i18n` and associated integration libraies are all licensed under the Apache-2.0 license. See the [LICENSE](/LICENSE) file for details.
