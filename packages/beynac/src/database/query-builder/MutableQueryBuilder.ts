import { BaseClass } from "../../utils.ts";
import type { DatabaseGrammar, JoinType } from "../grammar/DatabaseGrammar.ts";
import type { LockOptions, SqlFragments, StringOrFragment } from "../query-types.ts";

const DEFAULT_LIMIT_FOR_OFFSET = 2 ** 31 - 1;

interface JoinEntry {
	type: JoinType;
	clause: SqlFragments;
}

export class MutableQueryBuilder extends BaseClass {
	readonly #from: SqlFragments;
	readonly #grammar: DatabaseGrammar;
	#joins: JoinEntry[] = [];
	#select: string[] = [];
	#where: SqlFragments[] = [];
	#groupBy: string[] = [];
	#having: SqlFragments[] = [];
	#orderBy: string[] = [];
	#limit: number | null = null;
	#offset: number | null = null;
	#distinct = false;
	#lockType?: "UPDATE" | "SHARE";
	#lockOptions?: LockOptions | undefined;

	constructor(from: SqlFragments, grammar: DatabaseGrammar) {
		super();
		this.#from = from;
		this.#grammar = grammar;
	}

	pushJoin(type: JoinType, clause: SqlFragments): void {
		this.#joins.push({ type, clause });
	}

	setSelect(columns: string[]): void {
		this.#select = columns;
	}

	pushSelect(columns: string[]): void {
		this.#select.push(...columns);
	}

	pushWhere(condition: SqlFragments): void {
		this.#where.push(condition);
	}

	pushGroupBy(columns: string[]): void {
		this.#groupBy.push(...columns);
	}

	pushHaving(condition: SqlFragments): void {
		this.#having.push(condition);
	}

	pushOrderBy(columns: string[]): void {
		this.#orderBy.push(...columns);
	}

	setOrderBy(columns: string[]): void {
		this.#orderBy = [...columns];
	}

	setLimit(n: number): void {
		this.#limit = n;
	}

	setOffset(n: number): void {
		this.#offset = n;
	}

	setDistinct(): void {
		this.#distinct = true;
	}

	setLock(type: "UPDATE" | "SHARE", options: LockOptions | undefined): void {
		this.#lockType = type;
		this.#lockOptions = options;
	}

	compile(): SqlFragments {
		const grammar = this.#grammar;

		const select =
			"SELECT" +
			(this.#distinct ? " DISTINCT " : " ") +
			(this.#select.length > 0 ? this.#select.join(", ") : "*");

		const limit = this.#limit ?? (this.#offset !== null ? DEFAULT_LIMIT_FOR_OFFSET : null);

		const parts = [
			select,
			"FROM",
			this.#from,
			...this.#joins.flatMap(({ type, clause }) => [grammar.compileJoin(type, "").trim(), clause]),
			...andClause("WHERE", this.#where),
			...listClause("GROUP BY", this.#groupBy),
			...andClause("HAVING", this.#having),
			...listClause("ORDER BY", this.#orderBy),
			limit !== null ? `LIMIT ${limit}` : null,
			this.#offset !== null ? `OFFSET ${this.#offset}` : null,
			this.#lockType ? grammar.compileLock(this.#lockType, this.#lockOptions) : null,
		];

		const merged = mergeFragments(...parts);

		const quotedItems = merged.sqlFragments.map((item): StringOrFragment => {
			if (typeof item === "string") {
				return grammar.quoteIdentifiers(item);
			}
			return { sql: grammar.quoteIdentifiers(item.sql), param: item.param };
		});

		return { sqlFragments: quotedItems };
	}
}

function listClause(type: string, items: string[]): Array<SqlFragments | string> {
	if (items.length === 0) {
		return [];
	}

	return [type, items.join(", ")];
}

function andClause(type: string, conditions: SqlFragments[]): Array<SqlFragments | string> {
	if (conditions.length === 0) {
		return [];
	}

	const result: Array<SqlFragments | string> = [type];

	result.push("(");
	for (let i = 0; i < conditions.length; i++) {
		if (i > 0) {
			result.push(") AND (");
		}
		result.push(conditions[i]);
	}
	result.push(")");

	return result;
}

function mergeFragments(...parts: Array<string | SqlFragments | null | undefined>): SqlFragments {
	const items: StringOrFragment[] = [];

	for (const part of parts) {
		if (!part) continue;
		if (typeof part === "string") {
			items.push(part);
		} else {
			items.push(...part.sqlFragments);
		}
	}

	return { sqlFragments: items };
}
