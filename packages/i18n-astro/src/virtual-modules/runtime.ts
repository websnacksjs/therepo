import { arrayOf, code, imp, literalOf } from "ts-poet";
import { defineVirtualModule, type VirtualModule } from "../virtual-module.js";

export type ClientVirtualModuleOptions = {
	supportedLocales: string[];
	namespaces: string[];
	messagesUrlPrefix: string;
	messagesDir: URL;
};

export default function runtimeVirtualModule({
	supportedLocales,
	namespaces = [],
	messagesUrlPrefix,
	messagesDir,
}: ClientVirtualModuleOptions): VirtualModule {
	const I18n = imp("I18n=@websnacksjs/i18n");
	return defineVirtualModule({
		moduleId: "runtime",
		content: code`
			const i18n = new ${I18n}({
				supportedLocales: ${arrayOf(...supportedLocales)},
				namespaces: ${arrayOf(...namespaces)},
				messagesUrlTemplate: typeof window === "undefined"
					? new URL("./:locale/:namespace.json", ${literalOf(messagesDir)})
					: new URL(${literalOf(`/${messagesUrlPrefix}/:locale/:namespace.json`)}, window.location.origin),
			});
			export default i18n;
		`,
	});
}
