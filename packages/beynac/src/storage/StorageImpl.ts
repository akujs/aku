import { inject } from "../container/inject.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { Dispatcher as DispatcherKey } from "../core/contracts/Dispatcher.ts";
import { onResetAllMocks } from "../testing/mocks.ts";
import { MemoryEndpoint } from "./adapters/memory/MemoryEndpoint.ts";
import type {
	Storage,
	StorageAdapter,
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "./contracts/Storage.ts";
import { DelegatesToDirectory } from "./DelegatesToDirectory.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";
import { StorageEndpointBuilder } from "./StorageEndpointBuilder.ts";
import { DiskNotFoundError } from "./storage-errors.ts";

type StorageConfig = Pick<Configuration, "disks" | "defaultDisk">;

let anonDiskId = 0;

export class StorageImpl extends DelegatesToDirectory implements Storage {
	#disks: Map<string, StorageDisk> = new Map();
	#defaultDiskName: string;
	#originalEndpoints: Map<string, StorageEndpoint> = new Map();
	#dispatcher: Dispatcher;
	#diskBuilder: StorageEndpointBuilder;

	constructor(
		config: StorageConfig = inject(Configuration),
		dispatcher: Dispatcher = inject(DispatcherKey),
		diskBuilder: StorageEndpointBuilder = inject(StorageEndpointBuilder),
	) {
		super();
		this.#dispatcher = dispatcher;
		this.#diskBuilder = diskBuilder;
		for (const [name, adapterOrEndpoint] of Object.entries(config.disks ?? {})) {
			const endpoint = this.#diskBuilder.build(adapterOrEndpoint);
			this.#originalEndpoints.set(name, endpoint);
			this.#register(name, endpoint);
		}

		this.#defaultDiskName = config.defaultDisk ?? "local";
	}

	#register(name: string, endpoint: StorageEndpoint): void {
		const disk = new StorageDiskImpl(name, endpoint, this.#dispatcher);
		this.#disks.set(name, disk);
	}

	disk(name?: string): StorageDisk {
		if (name == null) {
			name = this.#defaultDiskName;
		}
		const disk = this.#disks.get(name);

		if (!disk) {
			throw new DiskNotFoundError(name);
		}

		return disk;
	}

	build(adapterOrEndpoint: StorageAdapter | StorageEndpoint, name?: string): StorageDisk {
		const endpoint = this.#diskBuilder.build(adapterOrEndpoint);
		return new StorageDiskImpl(name ?? `anonymous${++anonDiskId}`, endpoint, this.#dispatcher);
	}

	mock(diskName: string, endpoint?: StorageEndpoint): void {
		// Replace the disk with provided endpoint or a default memory adapter
		const mockEndpoint = endpoint ?? new MemoryEndpoint({});
		this.#register(diskName, mockEndpoint);
		onResetAllMocks(() => this.resetMocks());
	}

	resetMocks(): void {
		for (const [name, endpoint] of this.#originalEndpoints) {
			this.#register(name, endpoint);
		}
	}

	protected override getDirectoryForDelegation(): StorageDirectoryOperations {
		return this.disk();
	}
}
