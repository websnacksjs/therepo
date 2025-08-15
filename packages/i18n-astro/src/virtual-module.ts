import type { Code } from "ts-poet";
import type { Plugin } from "vite";

export type VirtualModuleOptions = {
	moduleId: string;
	content: Code;
};

export type VirtualModule = {
	moduleId: string;
	plugin: Plugin;
};

export const defineVirtualModule = ({
	moduleId,
	content,
}: VirtualModuleOptions): VirtualModule => {
	moduleId = `@websnacksjs/i18n-astro:${moduleId}`;
	const resolvedModuleId = `\0${moduleId}`;
	return {
		moduleId,
		plugin: {
			name: moduleId,
			resolveId(id) {
				if (id !== moduleId) {
					return;
				}
				return resolvedModuleId;
			},
			load(id) {
				if (id !== resolvedModuleId) {
					return;
				}
				return content.toString();
			},
		},
	};
};
