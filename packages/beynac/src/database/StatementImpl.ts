import { BaseClass } from "../utils.ts";
import { toHumanReadableSql } from "./query-builder/statement-render.ts";
import type { Statement } from "./Statement.ts";

// Implementation of the Statement interface.
export class StatementImpl extends BaseClass implements Statement {
	readonly fragments: readonly string[];
	readonly params: unknown[];

	constructor(fragments: readonly string[], params: unknown[]) {
		super();
		this.fragments = fragments;
		this.params = params;
	}

	toHumanReadableSql(): string {
		return toHumanReadableSql(this);
	}
}
