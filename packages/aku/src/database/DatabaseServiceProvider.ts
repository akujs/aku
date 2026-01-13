import { Configuration } from "../core/contracts/Configuration.ts";
import { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { Database } from "./contracts/Database.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";

export class DatabaseServiceProvider extends ServiceProvider {
	override register(): void {
		const config = this.container.get(Configuration);
		if (config.database) {
			const dispatcher = this.container.get(Dispatcher);
			this.container.singletonInstance(Database, new DatabaseImpl(config.database, dispatcher));
		}
	}
}
