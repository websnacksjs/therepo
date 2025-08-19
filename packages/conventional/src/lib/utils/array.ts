export const uniqueBy = <T>(items: T[], keyFn: (item: T) => string): T[] => {
	const seen = new Set();
	items = items.filter((x) => {
		const key = keyFn(x);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
	return items;
};

export const removeElements = <T>(
	elements: T[],
	pred: (elem: T) => boolean,
): T[] => {
	const removedElements: T[] = [];
	let newLength = 0;
	for (const elem of elements) {
		if (pred(elem)) {
			removedElements.push(elem);
			continue;
		}

		elements[newLength++] = elem;
	}
	elements.length = newLength;
	return removedElements;
};
