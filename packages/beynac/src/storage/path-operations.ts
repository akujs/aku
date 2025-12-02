// oxlint-disable-next-line eslint/no-restricted-imports -- This is the centralized path utility that wraps node:path
import * as nodePath from "node:path";
import { onResetAllMocks } from "../testing/mocks.ts";

type PathOps = Pick<typeof nodePath, "normalize" | "join" | "dirname" | "basename" | "extname">;

export const posix: PathOps = {
	normalize: (...args) => nodePath.posix.normalize(...args),
	join: (...args) => nodePath.posix.join(...args),
	dirname: (...args) => nodePath.posix.dirname(...args),
	basename: (...args) => nodePath.posix.basename(...args),
	extname: (...args) => nodePath.posix.extname(...args),
};

export const win32: PathOps = {
	normalize: (...args) => nodePath.win32.normalize(...args),
	join: (...args) => nodePath.win32.join(...args),
	dirname: (...args) => nodePath.win32.dirname(...args),
	basename: (...args) => nodePath.win32.basename(...args),
	extname: (...args) => nodePath.win32.extname(...args),
};

const native: PathOps = {
	normalize: (...args) => nodePath.normalize(...args),
	join: (...args) => nodePath.join(...args),
	dirname: (...args) => nodePath.dirname(...args),
	basename: (...args) => nodePath.basename(...args),
	extname: (...args) => nodePath.extname(...args),
};

export const platform: PathOps = {
	normalize: (...args) => getPlatformOps().normalize(...args),
	join: (...args) => getPlatformOps().join(...args),
	dirname: (...args) => getPlatformOps().dirname(...args),
	basename: (...args) => getPlatformOps().basename(...args),
	extname: (...args) => getPlatformOps().extname(...args),
};

let platformOps: PathOps | "require" = native;

const getPlatformOps = (): PathOps => {
	if (platformOps == "require") {
		const message =
			"This test must select a platform for path operations because it tests functionality using filesystem paths";
		throw new Error(message);
	}
	return platformOps;
};

export function mockPlatformPaths(ops: "posix" | "win32" | "require" | "native"): void {
	switch (ops) {
		case "posix":
			platformOps = posix;
			break;
		case "win32":
			platformOps = win32;
			break;
		case "require":
			platformOps = "require";
			break;
		case "native":
			platformOps = native;
			break;
	}
}

// Reset platform operations when mocks are reset
onResetAllMocks(() => {
	platformOps = "require";
});
