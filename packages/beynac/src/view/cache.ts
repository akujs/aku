import { inject } from "../container/inject.ts";
import { BaseComponent } from "./Component.ts";
import type { ViewRenderer } from "./contracts/ViewRenderer.ts";
import { ViewRenderer as ViewRendererToken } from "./contracts/ViewRenderer.ts";
import { RawContent } from "./raw.ts";
import type { Context, JSXElement, PropsWithChildren } from "./view-types.ts";
import { tagAsJsxElement } from "./view-types.ts";

type CacheProps = PropsWithChildren<{
	map: Map<string, string>;
	key: string;
}>;

export class Cache extends BaseComponent<CacheProps> {
	static displayName = "Cache";
	#renderer: ViewRenderer;

	constructor(props: CacheProps, renderer: ViewRenderer = inject(ViewRendererToken)) {
		super(props);
		this.#renderer = renderer;
	}

	async render(context: Context): Promise<JSXElement> {
		const { map, key, children } = this.props;
		const cached = map.get(key);
		if (cached != null) {
			return tagAsJsxElement(new RawContent(cached));
		}

		const rendered = await this.#renderer.render(children, { context });
		map.set(key, rendered);

		return tagAsJsxElement(new RawContent(rendered));
	}
}
