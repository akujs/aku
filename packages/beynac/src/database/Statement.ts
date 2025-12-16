import { BaseClass } from "../utils.ts";

export interface SqlFragment {
	sql: string;
	param: unknown;
}

export class SqlFragments extends BaseClass {
	readonly #sqlFragments: readonly (string | SqlFragment)[];

	constructor(sqlFragments: (string | SqlFragment)[]) {
		super();
		this.#sqlFragments = sqlFragments;
	}

	get sqlFragments(): readonly (string | SqlFragment)[] {
		return this.#sqlFragments;
	}
}

export function isSqlFragments(value: unknown): value is SqlFragments {
	return value instanceof SqlFragments;
}

export interface Statement extends SqlFragments {
	/**
	 * Render this statement for logging, with parameter values inlined.
	 */
	toHumanReadableSql(): string;
}

export interface StatementResult {
	rows: Row[];
	rowsAffected: number;
}

export type Row = Record<string, unknown>;
