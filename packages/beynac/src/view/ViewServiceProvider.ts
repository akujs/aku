import { ServiceProvider } from "../core/ServiceProvider.ts";
import { ViewRenderer } from "./contracts/ViewRenderer.ts";
import { ViewRendererImpl } from "./ViewRendererImpl.ts";

export class ViewServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(ViewRenderer, ViewRendererImpl);
	}
}
