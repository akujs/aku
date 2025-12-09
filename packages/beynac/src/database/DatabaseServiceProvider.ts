import { Configuration } from "../core/contracts/Configuration.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { Database } from "./contracts/Database.ts";
import type { DatabaseAdapter, DatabaseConfig } from "./DatabaseAdapter.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";

export class DatabaseServiceProvider extends ServiceProvider {
	override register(): void {
		const config = this.container.get(Configuration);
		if (config.database) {
			const { defaultAdapter, additionalAdapters } = normalizeDatabaseConfig(config.database);
			this.container.singletonInstance(
				Database,
				new DatabaseImpl(defaultAdapter, additionalAdapters),
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
