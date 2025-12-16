import { BaseClass } from "../../utils.ts";
import type { DatabaseGrammar, JoinType } from "../grammar/DatabaseGrammar.ts";
import type { SqlFragments } from "../Statement.ts";
import type { LockOptions } from "./QueryBuilder.ts";
import { andClause, mergeFragments } from "./statement-utils.ts";

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
			this.#where.length > 0 ? "WHERE" : null,
			this.#where.length > 0 ? andClause(this.#where) : null,
			this.#groupBy.length > 0 ? "GROUP BY " + this.#groupBy.join(", ") : null,
			this.#having.length > 0 ? "HAVING" : null,
			this.#having.length > 0 ? andClause(this.#having) : null,
			this.#orderBy.length > 0 ? "ORDER BY " + this.#orderBy.join(", ") : null,
			limit !== null ? `LIMIT ${limit}` : null,
			this.#offset !== null ? `OFFSET ${this.#offset}` : null,
			this.#lockType ? grammar.compileLock(this.#lockType, this.#lockOptions) : null,
		];

		const merged = mergeFragments(...parts);

		return {
			fragments: merged.fragments.map((f) => grammar.quoteIdentifiers(f)),
			params: merged.params,
		};
	}
}
