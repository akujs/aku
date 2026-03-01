import { afterEach, beforeEach, mock } from "bun:test";
import { BaseCommand } from "../cli/Command.ts";
import { whitelistDefaultBindingsForInternalTests } from "../container/ContainerImpl.ts";
import { BaseListener } from "../core/BaseListener.ts";
import { BaseController } from "../http/Controller.ts";
import { BaseMiddleware } from "../http/Middleware.ts";
import { mockPlatformPaths } from "../storage/path-operations.ts";
import { resetAllMocks } from "../testing/mocks.ts";

whitelistDefaultBindingsForInternalTests(BaseCommand, BaseController, BaseMiddleware, BaseListener);

beforeEach(() => {
	mockPlatformPaths("require");
});
afterEach(() => {
	mock.restore();
	resetAllMocks();
});
