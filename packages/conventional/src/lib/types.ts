export type Footer = {
	key: string;
	value: string;
};

export type CommitMessage = {
	type: string;
	scope?: string | undefined;
	isBreaking: boolean;
	description: string;
	body?: string | undefined;
	breakingChanges: string[];
	footers: Footer[];
};
