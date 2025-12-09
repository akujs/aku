import { Configuration } from "../core/contracts/Configuration.ts";
import { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { Database } from "./contracts/Database.ts";
import type { DatabaseAdapter, DatabaseConfig } from "./DatabaseAdapter.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";

export class DatabaseServiceProvider extends ServiceProvider {
	override register(): void {
		const config = this.container.get(Configuration);
		if (config.database) {
			const { defaultAdapter, additionalAdapters } = normalizeDatabaseConfig(config.database);
			const dispatcher = this.container.get(Dispatcher);
			this.container.singletonInstance(
				Database,
				new DatabaseImpl(defaultAdapter, additionalAdapters, dispatcher),
			);
		}
	}
}

function isDatabaseConfig(value: DatabaseAdapter | DatabaseConfig): value is DatabaseConfig {
	return "default" in value && typeof (value as DatabaseConfig).default === "object";
}

function normalizeDatabaseConfig(config: DatabaseAdapter | DatabaseConfig): {
	defaultAdapter: DatabaseAdapter;
	additionalAdapters: Record<string, DatabaseAdapter>;
} {
	if (isDatabaseConfig(config)) {
		return {
			defaultAdapter: config.default,
			additionalAdapters: config.additional ?? {},
		};
	}
	return {
		defaultAdapter: config,
		additionalAdapters: {},
	};
}
