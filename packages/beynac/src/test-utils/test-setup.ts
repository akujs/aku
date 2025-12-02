import { afterEach, beforeEach, mock } from "bun:test";
import { mockPlatformPaths } from "../storage/path-operations.ts";
import { resetAllMocks } from "../testing/mocks.ts";

beforeEach(() => {
	mockPlatformPaths("require");
});
afterEach(() => {
	mock.restore();
	resetAllMocks();
});
