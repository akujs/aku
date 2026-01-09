import { Configuration } from "../core/contracts/Configuration.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware.ts";
import { CookiesImpl } from "./CookiesImpl.ts";
import { Cookies } from "./contracts/Cookies.ts";
import { Headers } from "./contracts/Headers.ts";
import { KeepAlive } from "./contracts/KeepAlive.ts";
import { RequestLocals } from "./contracts/RequestLocals.ts";
import { HeadersImpl } from "./HeadersImpl.ts";
import { group } from "./helpers.ts";
import { KeepAliveImpl } from "./KeepAliveImpl.ts";
import { RequestHandler } from "./RequestHandler.ts";
import { RequestLocalsImpl } from "./RequestLocalsImpl.ts";
import { Router } from "./Router.ts";
import { RouteUrlGenerator } from "./RouteUrlGenerator.ts";

export class HttpServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(Router);
		this.container.singleton(RequestHandler);
		this.container.singleton(RouteUrlGenerator);
		this.container.scoped(Headers, HeadersImpl);
		this.container.scoped(Cookies, CookiesImpl);
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.scoped(KeepAlive, KeepAliveImpl);
	}

	override boot(): void {
		const config = this.container.get(Configuration);
		const router = this.container.get(Router);
		const urlGenerator = this.container.get(RouteUrlGenerator);

		if (config.routes) {
			const autoRefreshEnabled = config.development && config.devMode?.autoRefresh !== false;

			if (autoRefreshEnabled) {
				const wrappedRoutes = group({ middleware: DevModeAutoRefreshMiddleware }, [config.routes]);
				router.register(wrappedRoutes);
				urlGenerator.register(wrappedRoutes);
			} else {
				router.register(config.routes);
				urlGenerator.register(config.routes);
			}
		}
	}
}
