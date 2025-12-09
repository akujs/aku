/***/
export interface SqliteDatabaseAdapterConfig {
	/**
	 * The path to the database file, or :memory: to use an in-memory database.
	 */
	path: string;

	/**
	 * If true, open the database in read-only mode.
	 */
	readOnly?: boolean;

	/**
	 * If false, disable the default behaviour of creating the database file and
	 * any missing parent directories if they don't exist.
	 *
	 * @default true
	 */
	create?: boolean;

	/**
	 * If false, disable the default behaviour of enabling write-ahead-logging
	 * (WAL) mode for the database. This is recommended for performance.
	 *
	 * @see https://sqlite.org/wal.html
	 *
	 * @default true
	 */
	useWalMode?: boolean;
}
