import { Configuration } from "../core/contracts/Configuration.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { Database } from "./contracts/Database.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";

export class DatabaseServiceProvider extends ServiceProvider {
	override register(): void {
		const config = this.container.get(Configuration);
		if (config.database) {
			this.container.singletonInstance(Database, new DatabaseImpl(config.database));
		}
	}
}
