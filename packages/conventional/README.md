# @websnacksjs/conventional

A lightweight, zero-depenency cli tool for enforcing [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) standards on commit messages.

Designed as a simpler and opinionated alternative to [`commitlint`](https://commitlint.js.org/) with a convention-over-configuration philosophy.

## 📦 Installation

```bash
npm install @websnacksjs/conventional
# or
yarn add @websnacksjs/conventional
# or
pnpm add @websnacksjs/conventional
```

## 🚀 Quick Start

[`huksy`](https://typicode.github.io/husky/) is recommended as a lightweight way to automate configuration of git commit hooks in local checkouts of your code:

```bash
npm install --save-dev husky && npx husky init
```

Once `husky` is installed and configured, using `@websnacksjs/conventional` is as simple as adding a new `.husky/commit-msg` file:

**`./.husky/commit-msg`**

```bash
npx conventional commit-msg "$1"
```

From now on, commit messages will be validated to meet the conventional commit v1.0.0 specification by `@websnacksjs/conventional`.

## 📖 Usage Details

### ⚙️ User-defined commit message validations

By default, `@websnacksjs/conventional` will only ensure that commit messages are valid conventional commit message. If you want to add additional validations (such as only allowing certain scopes or commit types), you can add a `conventional.config.js` file to the root of your repository:

**`./conventional.config.js`**

```js
import { defineConfig } from '@websnacksjs/conventional';

const validTypes = ['feat', 'fix', 'chore'];

export default defineConfig({
    validateCommitMessage(commitMessage) {
        // commitMessage is a parsed version of the conventional commit message
        if (!validTypes.includes(commitMessage.scope)) {
            throw new Error(`${commitMessage.scope} is not a valid scope`)
        }
    }
});
```

Now, properly formatted conventional commit messages that aren't one of "feat", "fix", or "chore" will be rejected.

### 🧹 Normalized whitespace & formatting

`@websnacksjs/conventional` will correct poor formatting in commit messages automatically. This includes:

- Removing leading & trailing whitespace in commit message scopes, descriptions, bodies, and footer values;
- Adding correct new lines to separate commit message summary lines from bodies and footers;
- Collapsing whitespace in commit message scopes, descriptions, bodies, and breaking changes and footers;
- Converting the first character to lowercase in descriptions and footer values;
- Adding missing puncuation to commit message descriptions, bodies, and breaking changes;
- Converting the first character to uppercase in commit message bodies and breaking changes;
- Converting "BREAKING-CHANGE" footers to "BREAKING CHANGE" for consistency.
- Adding breaking signifier "!" to commit message summaries when BREAKING CHANGE footers are present.

For example:

```plaintext
feat(  subpackage-a ):     added   lots of new features
adds a lot of neat stuff

you should    check it out brah!

BREAKING-CHANGE: it's gonna break production, gurranteed

authored-by: Someone

```

Is normalized to:

```plaintext
feat(subpackage-a)!: added lots of new features

Adds a lot of neat stuff.

You should check it out brah!

BREAKING CHANGE: it's gonna break production, gurranteed

Authored-by: Someone
```

Additionally, it tries to detect common mistakes such as missing full commit descriptions and bodies that have a trailing comma:

```plaintext
feat(subpackage-a): added new feature,
// ^ Rejected: trailing comma indicates potential copy-paste error and partly missing description
```

And rejecting commits with summaries over 80 lines long (which get truncated in most git UIs):

```plaintext
feat(subpackage-a): this adds TONS of new features such as walking your dog, buying groceries, paying your bills, and more!
// ^ Rejected: commit summary is over 80 lines long and would result in truncation
```

## 📜 License

`@websnacksjs/conventional` is licensed under the Apache-2.0 license. See the [LICENSE](/LICENSE) file for details.
