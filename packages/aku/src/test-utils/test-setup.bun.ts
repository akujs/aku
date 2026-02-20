import { afterEach, beforeEach, mock } from "bun:test";
import { whitelistDefaultBindings } from "../container/ContainerImpl.ts";
import { BaseListener } from "../core/BaseListener.ts";
import { BaseController } from "../http/Controller.ts";
import { BaseMiddleware } from "../http/Middleware.ts";
import { mockPlatformPaths } from "../storage/path-operations.ts";
import { resetAllMocks } from "../testing/mocks.ts";

whitelistDefaultBindings(BaseController, BaseMiddleware, BaseListener);

beforeEach(() => {
	mockPlatformPaths("require");
});
afterEach(() => {
	mock.restore();
	resetAllMocks();
});
