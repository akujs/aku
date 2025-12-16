export interface SqlFragments {
	readonly fragments: readonly string[];
	readonly params: unknown[];
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
