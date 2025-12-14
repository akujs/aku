import { BaseClass } from "../../utils.ts";
import type { SqlFragments } from "../Statement.ts";
import type { LockOptions } from "./QueryBuilder.ts";
import { quotePostgresIdentifiers } from "./quotePostgresIdentifiers.ts";

export class MutableQueryBuilder extends BaseClass {
	readonly #from: string;
	#join: string[] = [];
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

	constructor(from: string) {
		super();
		this.#from = from;
	}

	pushJoin(type: string, clause: string): void {
		this.#join.push(type, clause);
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
		const parts = [
			"SELECT",
			this.#distinct && "DISTINCT",
			this.#select.length > 0 ? this.#select.join(", ") : "*",
			"FROM",
			this.#from,
			...this.#join,
			andClause("WHERE", this.#where),
			listClause("GROUP BY", this.#groupBy),
			andClause("HAVING", this.#having),
			listClause("ORDER BY", this.#orderBy),
			this.#limit !== null && `LIMIT ${this.#limit}`,
			this.#offset !== null && `OFFSET ${this.#offset}`,
			this.#lockType && "FOR",
			this.#lockType,
			this.#lockOptions?.noWait && "NOWAIT",
			this.#lockOptions?.skipLocked && "SKIP LOCKED",
		];

		const sql = quotePostgresIdentifiers(parts.filter(Boolean).join(" "));
		return { fragments: [sql], params: [] };
	}
}

function andClause(keyword: string, conditions: string[]): string | false {
	return conditions.length > 0 && `${keyword} (${conditions.join(") AND (")})`;
}

function listClause(keyword: string, items: string[]): string | false {
	return items.length > 0 && `${keyword} ${items.join(", ")}`;
}
