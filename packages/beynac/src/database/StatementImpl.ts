import { toHumanReadableSql } from "./query-builder/statement-render.ts";
import { type SqlFragment, SqlFragments, type Statement } from "./Statement.ts";

// Implementation of the Statement interface.
export class StatementImpl extends SqlFragments implements Statement {
	constructor(sqlFragments: (string | SqlFragment)[]) {
		super(sqlFragments);
	}

	toHumanReadableSql(): string {
		return toHumanReadableSql(this);
	}
}
