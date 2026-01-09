import { BaseClass } from "../../utils.ts";
import type {
	ConflictOptions,
	DistinctOptions,
	Executor,
	InsertPart,
	JoinEntry,
	JoinType,
	LockPart,
	QueryParts,
	Row,
	SqlFragments,
	UnionEntry,
	UpdateFromPart,
} from "../query-types.ts";

export class MutableQueryBuilder extends BaseClass implements QueryParts {
	table = "";
	joins: JoinEntry[] = [];
	select: string[] = [];
	where: SqlFragments[] = [];
	groupBy: string[] = [];
	having: SqlFragments[] = [];
	orderBy: string[] = [];
	limit: number | null = null;
	offset: number | null = null;
	distinct: DistinctOptions | null = null;
	lock: LockPart | null = null;
	insert: InsertPart | null = null;
	conflict: ConflictOptions | null = null;
	updateAll: Row | null = null;
	updateFrom: UpdateFromPart | null = null;
	deleteAll: boolean = false;
	returningColumns: string[] | null = null;
	executor: Executor | null = null;
	prepare: boolean | null = null;
	exists: boolean = false;
	unionMembers: UnionEntry[] | null = null;

	setTable(table: string): void {
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

	setDistinct(options: DistinctOptions | null): void {
		this.distinct = options;
	}

	setLock(lock: LockPart): void {
		this.lock = lock;
	}

	setInsert(insert: InsertPart): void {
		this.insert = insert;
	}

	setConflict(conflict: ConflictOptions): void {
		this.conflict = conflict;
	}

	setUpdateAll(data: Row): void {
		this.updateAll = data;
	}

	setUpdateFrom(part: UpdateFromPart): void {
		this.updateFrom = part;
	}

	setDeleteAll(): void {
		this.deleteAll = true;
	}

	setReturning(columns: string[]): void {
		this.returningColumns = columns;
	}

	setExecutor(executor: Executor): void {
		this.executor = executor;
	}

	setPrepare(value: boolean): void {
		this.prepare = value;
	}

	setExists(): void {
		this.exists = true;
	}

	pushUnionMember(type: "UNION" | "UNION ALL" | null, statement: SqlFragments): void {
		(this.unionMembers ??= []).push({ type, statement });
	}
}
