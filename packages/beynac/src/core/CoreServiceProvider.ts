import { Dispatcher } from "./contracts/Dispatcher.ts";
import { DispatcherImpl } from "./DispatcherImpl.ts";
import { ServiceProvider } from "./ServiceProvider.ts";

export class CoreServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(Dispatcher, DispatcherImpl);
	}
}
