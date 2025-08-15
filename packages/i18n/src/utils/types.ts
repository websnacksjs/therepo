import type { Dictionary, KeySelector, StringKey } from "./dictionary.js";

export type NamespacedMessages = Record<string, Dictionary> & {
	common: Dictionary;
};

export type NamespacedKeyOf<Messages extends Record<string, Dictionary>> = {
	[Namespace in StringKey<Messages>]: `${Namespace}:${KeySelector<Messages[Namespace]>}`;
}[StringKey<Messages>];

export type KeyOf<Messages extends NamespacedMessages> =
	| KeySelector<Messages["common"]>
	| NamespacedKeyOf<Omit<Messages, "common">>;

export type NamespacesOf<Messages extends NamespacedMessages> = Exclude<
	StringKey<Messages>,
	"common"
>;

export type NamespacesSubset<
	Messages extends NamespacedMessages,
	NS extends NamespacesOf<NamespacedMessages>,
> = Pick<Messages, NS | "common">;

export type TFunction<
	Messages extends NamespacedMessages,
	NS extends NamespacesOf<Messages>,
> = {
	<Key extends KeyOf<Pick<Messages, NS | "common">>>(
		key: Key,
		substitutions?: Record<string, string>,
	): string;
	locale(): string;
};
