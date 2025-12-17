import { BaseClass } from "../utils.ts";
import { toHumanReadableSql } from "./query-builder/statement-render.ts";
import type { Statement, StringOrFragment } from "./query-types.ts";

export class StatementImpl extends BaseClass implements Statement {
	readonly #sqlFragments: readonly StringOrFragment[];

	constructor(sqlFragments: StringOrFragment[]) {
		super();
		this.#sqlFragments = sqlFragments;
	}

	get sqlFragments(): readonly StringOrFragment[] {
		return this.#sqlFragments;
	}

	toHumanReadableSql(): string {
		return toHumanReadableSql(this);
	}
}
