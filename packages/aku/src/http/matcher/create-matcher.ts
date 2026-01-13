import { NullProtoObj } from "./matcher-utils.ts";
import type { MatcherContext } from "./types.ts";

export function createMatcher<T = unknown>(): MatcherContext<T> {
	const ctx: MatcherContext<T> = {
		root: { key: "" },
		static: new NullProtoObj(),
	};
	return ctx;
}
