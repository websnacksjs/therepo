/**
 * Abstract representation of a Record with string keys and values which can be
 * arbitrarily nested.
 */
export type Dictionary = {
	[key: string]: string | Dictionary;
};

/**
 * Type guard for checking whether a value has the shape of a
 * {@link Dictionary}.
 */
export const isDictionary = (value: unknown): value is Dictionary => {
	return typeof value === "object" && value !== null;
};

/**
 * Helper type to extract only string keys from a Dictionary to work around the
 * `keyof` type operator returning non-string keys from object types.
 */
export type StringKey<T extends Dictionary> = Extract<keyof T, string>;

/**
 * Takes a concrete {@link Dictionary} and returns a union of dot-separated
 * string selectors used to extract a particular value at a particular level
 * of nesting.
 *
 * @example
 * type Keys = KeySelector<{
 *     role: 'best friend',
 *     actors: { "Peter": "Kyle Vogt", "Steven": "Greg Ellery" }
 * }>
 * // type Keys = "role" | "actors.Peter" | "actors.Steven"
 */
export type KeySelector<T extends Dictionary> = T extends Dictionary
	? {
			[K in StringKey<T>]: T[K] extends Dictionary
				? `${K}.${KeySelector<T[K]>}`
				: K;
		}[StringKey<T>]
	: never;

export const lookupValue = <
	Dict extends Dictionary,
	Key extends KeySelector<Dict>,
>(
	dictionary: Dict,
	key: Key,
): string => {
	const [prefix, ...rest] = key.split(".");
	if (rest.length === 0) {
		return dictionary[prefix as string] as string;
	}

	const subrecord = dictionary[prefix as keyof Dict] as Dictionary;
	return lookupValue(
		subrecord,
		rest.join(".") as StringKey<typeof subrecord>,
	) as string;
};
