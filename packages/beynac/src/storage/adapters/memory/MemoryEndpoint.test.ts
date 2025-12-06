import type { SharedTestConfig } from "../../storage-test-utils.bun.ts";
import { MemoryEndpoint } from "./MemoryEndpoint.ts";
import { memoryStorage } from "./memoryStorage.ts";

export const memoryStorageSharedTestConfig: SharedTestConfig = {
	name: memoryStorage.name,
	createEndpoint: () => new MemoryEndpoint({}),
};
