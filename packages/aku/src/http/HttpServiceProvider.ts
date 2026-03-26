import { ServiceProvider } from "../core/ServiceProvider.ts";
import { CookiesImpl } from "./CookiesImpl.ts";
import { Cookies } from "./contracts/Cookies.ts";
import { Headers } from "./contracts/Headers.ts";
import { KeepAlive } from "./contracts/KeepAlive.ts";
import { RequestLocals } from "./contracts/RequestLocals.ts";
import { HeadersImpl } from "./HeadersImpl.ts";
import { KeepAliveImpl } from "./KeepAliveImpl.ts";
import { RequestLocalsImpl } from "./RequestLocalsImpl.ts";

export class HttpServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.scoped(Headers, HeadersImpl);
		this.container.scoped(Cookies, CookiesImpl);
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.scoped(KeepAlive, KeepAliveImpl);
	}
}
