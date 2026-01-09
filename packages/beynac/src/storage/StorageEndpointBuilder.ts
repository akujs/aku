import { createTypeToken, type TypeToken } from "../container/container-key.ts";
import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import type { StorageAdapter, StorageEndpoint } from "./contracts/Storage.ts";
import { isConfiguredStorageDriver } from "./storage-utils.ts";

export interface StorageEndpointBuilder {
	build(adapter: StorageAdapter | StorageEndpoint): StorageEndpoint;
}

export class StorageEndpointBuilderImpl extends BaseClass implements StorageEndpointBuilder {
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	build(adapterOrEndpoint: StorageAdapter | StorageEndpoint): StorageEndpoint {
		if (isConfiguredStorageDriver(adapterOrEndpoint)) {
			return adapterOrEndpoint.build(this.#container);
		}
		return adapterOrEndpoint;
	}
}

export const StorageEndpointBuilder: TypeToken<StorageEndpointBuilder> =
	createTypeToken("StorageEndpointBuilder");
