import { BaseClass } from "../../utils.ts";
import type {
	InsertPart,
	JoinEntry,
	JoinType,
	LockPart,
	QueryParts,
	Row,
	SqlFragments,
	ThenExecutor,
} from "../query-types.ts";

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
	lock: LockPart | null = null;
	insert: InsertPart | null = null;
	updateData: Row | null = null;
	isDelete: boolean = false;
	returningColumns: string[] | null = null;
	thenExecutor: ThenExecutor | null = null;
	prepare: boolean | null = null;

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

	setLock(lock: LockPart): void {
		this.lock = lock;
	}

	setInsert(insert: InsertPart): void {
		this.insert = insert;
	}

	setUpdateData(data: Row): void {
		this.updateData = data;
	}

	setDelete(): void {
		this.isDelete = true;
	}

	setReturning(columns: string[]): void {
		this.returningColumns = columns;
	}

	setThenExecutor(executor: ThenExecutor): void {
		this.thenExecutor = executor;
	}

	setPrepare(value: boolean): void {
		this.prepare = value;
	}
}
