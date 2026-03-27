import { ServiceProvider } from "../core/ServiceProvider.ts";
import { KeepAlive } from "./contracts/KeepAlive.ts";
import { RequestLocals } from "./contracts/RequestLocals.ts";
import { KeepAliveImpl } from "./KeepAliveImpl.ts";
import { RequestLocalsImpl } from "./RequestLocalsImpl.ts";

export class HttpServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.scoped(KeepAlive, KeepAliveImpl);
	}
}
