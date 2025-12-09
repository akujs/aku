export interface Statement {
	readonly fragments: readonly string[];
	readonly params: unknown[];

	/**
	 * Render this statement as SQL with placeholders.
	 *
	 * @param renderPlaceholder - A function that returns the placeholder string for a given parameter index.
	 */
	renderSql(renderPlaceholder: (index: number) => string): string;

	/**
	 * Render this statement for logging, with parameter values inlined.
	 */
	renderForLogs(): string;
}

export interface StatementResult {
	rows: Row[];
	rowsAffected: number;
}

export type Row = Record<string, unknown>;
