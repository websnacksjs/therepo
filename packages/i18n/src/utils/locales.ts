/**
 * Returns whether the passed locale conforms to the RFC 5646 locale string
 * specification.
 *
 * Valid RFC 5646 locale strings must consist of 1-3 dash ("-") separated
 * subparts called "tags" representing a language, a script, and a region.
 *
 * Language  must be a valid
 *
 * @example
 * isValidRfc5646Locale("en-Latn-US") // returns true
 * isValidRfc5646Locale("fr-Arab") // returns true
 * isValidRfc5646Locale("fr-CA") // returns true
 * isValidRfc5646Locale("US_en") // returns false
 */
export const isValidRfc5646Locale = (locale: string): boolean => {
	try {
		new Intl.Locale(locale);
	} catch {
		return false;
	}
	return true;
};

/**
 * Returns whether a locale is in the proper maximalized form with all three
 * tags for language, script, and region.
 */
export const isMaximizedLocale = (locale: string): boolean => {
	return locale === new Intl.Locale(locale).maximize().toString();
};

/**
 * Heuristically guess what the missing script and/or region tags of a locale
 * string are using the "Add Likely Subtags" algorithm defined in RFC 5646.
 */
export const maximizeLocale = (locale: string): string => {
	return new Intl.Locale(locale).maximize().toString();
};
