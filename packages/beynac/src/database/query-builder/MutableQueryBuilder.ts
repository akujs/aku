import { BaseClass } from "../../utils.ts";
import type { DatabaseGrammar, JoinType } from "../grammar/DatabaseGrammar.ts";
import type { SqlFragments } from "../Statement.ts";
import type { LockOptions } from "./QueryBuilder.ts";

const DEFAULT_LIMIT_FOR_OFFSET = 2 ** 31 - 1;

type JoinEntry = [type: JoinType, clause: string];

export class MutableQueryBuilder extends BaseClass {
	readonly #from: string;
	readonly #grammar: DatabaseGrammar;
	#joins: JoinEntry[] = [];
	#select: string[] = [];
	#where: string[] = [];
	#groupBy: string[] = [];
	#having: string[] = [];
	#orderBy: string[] = [];
	#limit: number | null = null;
	#offset: number | null = null;
	#distinct = false;
	#lockType?: "UPDATE" | "SHARE";
	#lockOptions?: LockOptions | undefined;

	constructor(from: string, grammar: DatabaseGrammar) {
		super();
		this.#from = from;
		this.#grammar = grammar;
	}

	pushJoin(type: JoinType, clause: string): void {
		this.#joins.push([type, clause]);
	}

	setSelect(columns: string[]): void {
		this.#select = columns;
	}

	pushSelect(columns: string[]): void {
		this.#select.push(...columns);
	}

	pushWhere(condition: string): void {
		this.#where.push(condition);
	}

	pushGroupBy(columns: string[]): void {
		this.#groupBy.push(...columns);
	}

	pushHaving(condition: string): void {
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

		// If offset is set without limit, use a default high limit value
		const limit = this.#limit ?? (this.#offset !== null ? DEFAULT_LIMIT_FOR_OFFSET : null);

		// Compile joins using grammar
		const joinClauses = this.#joins.map(([type, clause]) => grammar.compileJoin(type, clause));

		// Compile lock clause using grammar
		const lockClause = this.#lockType ? grammar.compileLock(this.#lockType, this.#lockOptions) : "";

		const parts = [
			"SELECT",
			this.#distinct && "DISTINCT",
			this.#select.length > 0 ? this.#select.join(", ") : "*",
			"FROM",
			this.#from,
			...joinClauses,
			andClause("WHERE", this.#where),
			listClause("GROUP BY", this.#groupBy),
			andClause("HAVING", this.#having),
			listClause("ORDER BY", this.#orderBy),
			limit !== null && `LIMIT ${limit}`,
			this.#offset !== null && `OFFSET ${this.#offset}`,
			lockClause,
		];

		const sql = grammar.quoteIdentifiers(parts.filter(Boolean).join(" "));
		return { fragments: [sql], params: [] };
	}
}

function andClause(keyword: string, conditions: string[]): string | false {
	return conditions.length > 0 && `${keyword} (${conditions.join(") AND (")})`;
}

function listClause(keyword: string, items: string[]): string | false {
	return items.length > 0 && `${keyword} ${items.join(", ")}`;
}
