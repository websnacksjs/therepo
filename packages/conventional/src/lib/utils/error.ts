export const normalizeError = (error: unknown): Error => {
	if (!(error instanceof Error)) {
		error = new Error(`non-Error type thrown: ${JSON.stringify(error)}`);
	}
	return error as Error;
};

const errorCauseChain = (error: Error): Error[] => {
	const causeChain: Error[] = [];
	let cause = error.cause;
	while (cause !== undefined) {
		causeChain.push(normalizeError(cause));

		if (cause instanceof Error) {
			cause = cause.cause;
		}
	}
	return causeChain;
};

export const formatError = (error: Error): string => {
	let message = error.message;
	const causeChain = errorCauseChain(error);
	for (const cause of causeChain) {
		message += `: ${cause.message}`;
	}
	return message;
};
