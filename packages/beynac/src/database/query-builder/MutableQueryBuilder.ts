import { BaseClass } from "../../utils.ts";
import type { JoinEntry, JoinType, LockOptions, QueryParts, SqlFragments } from "../query-types.ts";

export class MutableQueryBuilder extends BaseClass implements QueryParts {
	readonly table: string;
	joins: JoinEntry[] = [];
	select: string[] = [];
	where: SqlFragments[] = [];
	groupBy: string[] = [];
	having: SqlFragments[] = [];
	orderBy: string[] = [];
	limit: number | null = null;
	offset: number | null = null;
	distinct: boolean = false;
	lockType: "UPDATE" | "SHARE" | undefined = undefined;
	lockOptions: LockOptions | undefined = undefined;
	insertData: Record<string, unknown>[] | null = null;
	updateData: Record<string, unknown> | null = null;
	isDelete: boolean = false;

	constructor(table: string) {
		super();
		this.table = table;
	}

	pushJoin(type: JoinType, clause: SqlFragments): void {
		this.joins.push({ type, clause });
	}

	setSelect(columns: string[]): void {
		this.select = columns;
	}

	pushSelect(columns: string[]): void {
		this.select.push(...columns);
	}

	pushWhere(condition: SqlFragments): void {
		this.where.push(condition);
	}

	pushGroupBy(columns: string[]): void {
		this.groupBy.push(...columns);
	}

	pushHaving(condition: SqlFragments): void {
		this.having.push(condition);
	}

	pushOrderBy(columns: string[]): void {
		this.orderBy.push(...columns);
	}

	setOrderBy(columns: string[]): void {
		this.orderBy = [...columns];
	}

	setLimit(n: number): void {
		this.limit = n;
	}

	setOffset(n: number): void {
		this.offset = n;
	}

	setDistinct(): void {
		this.distinct = true;
	}

	setLock(type: "UPDATE" | "SHARE", options: LockOptions | undefined): void {
		this.lockType = type;
		this.lockOptions = options;
	}

	setInsertData(data: Record<string, unknown>[]): void {
		this.insertData = data;
	}

	setUpdateData(data: Record<string, unknown>): void {
		this.updateData = data;
	}

	setDelete(): void {
		this.isDelete = true;
	}
}
