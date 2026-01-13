import { Configuration } from "../core/contracts/Configuration.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware.ts";
import { DevModeWatchService } from "./DevModeWatchService.ts";

export class DevelopmentServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(DevModeAutoRefreshMiddleware);
		this.container.singleton(DevModeWatchService);
	}

	override boot(): void {
		const config = this.container.get(Configuration);

		const autoRefreshEnabled =
			config.development &&
			// TODO add configuration defaults so that each code usage doesn't need to know about the correct default
			config.devMode?.autoRefresh !== false;

		if (autoRefreshEnabled) {
			this.container.get(DevModeWatchService).start();
		}
	}
}
