import { ServiceProvider } from "../core/ServiceProvider.ts";
import { Storage } from "./contracts/Storage.ts";
import { StorageEndpointBuilder, StorageEndpointBuilderImpl } from "./StorageEndpointBuilder.ts";
import { StorageImpl } from "./StorageImpl.ts";

export class StorageServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(StorageEndpointBuilder, StorageEndpointBuilderImpl);
		this.container.singleton(Storage, StorageImpl);
	}
}
