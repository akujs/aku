import { pluralCount } from "../../utils.ts";
import { QueryError } from "../database-errors.ts";
import type { SqlFragment, SqlFragments, StringOrFragment } from "../query-types.ts";

export function getSqlFragmentsParams(statement: SqlFragments): unknown[] {
	const result: unknown[] = [];
	for (const item of statement.sqlFragments) {
		if (typeof item !== "string") {
			result.push(item.param);
		}
	}
	return result;
}

export function assertNoUndefinedParams(params: unknown[], sql: string): void {
	const undefinedIndex = params.findIndex((p) => p === undefined);
	if (undefinedIndex !== -1) {
		throw new QueryError(
			sql,
			`Cannot bind undefined for parameter ${undefinedIndex + 1}. Use null for NULL values.`,
			new Error("Undefined parameter"),
		);
	}
}

export function splitSqlToFragments(sql: string, values: unknown[]): SqlFragments {
	const parts = sql.split("?");
	const expectedCount = parts.length - 1;

	if (expectedCount !== values.length) {
		throw new Error(
			`SQL placeholder count mismatch: found ${pluralCount(expectedCount, "'?' placeholder marker")} but got ${pluralCount(values.length, "parameter")}. SQL: "${sql}". Consider using sql\`...\` if you need to include literal "?" characters in your SQL.`,
		);
	}

	if (values.length === 0) {
		return { sqlFragments: [sql] };
	}

	const items: StringOrFragment[] = [];

	for (let i = 0; i < values.length; i++) {
		items.push({ sql: parts[i], param: values[i] });
	}

	const lastPart = parts[parts.length - 1];
	if (lastPart) {
		items.push(lastPart);
	}

	return { sqlFragments: items };
}

export function expandArraysAndSubqueries(statement: SqlFragments): SqlFragments {
	const result: StringOrFragment[] = [];

	for (const item of statement.sqlFragments) {
		if (typeof item === "string") {
			result.push(item);
			continue;
		}

		const { sql, param } = item;

		if (isSqlFragments(param)) {
			result.push(...expandSubquery(sql, param));
		} else if (Array.isArray(param) && /\bIN\b\s*\(?\s*$/i.test(sql)) {
			result.push(...expandArrayParam(sql, param));
		} else {
			result.push(item);
		}
	}

	return { sqlFragments: result };
}

function expandSubquery(precedingSql: string, subquery: SqlFragments): StringOrFragment[] {
	const expanded = expandArraysAndSubqueries(subquery);
	return [precedingSql, "(", ...expanded.sqlFragments, ")"];
}

function expandArrayParam(precedingSql: string, arr: unknown[]): StringOrFragment[] {
	const hasUserParen = precedingSql.trim().endsWith("(");
	if (arr.length === 0) {
		// Empty array: use IN (NULL) - never matches
		return [precedingSql, hasUserParen ? "NULL" : "(NULL)"];
	}

	if (hasUserParen) {
		return [precedingSql, ...commaSeparatedFragments(arr.map(paramAsFragment))];
	}
	return [precedingSql, ...bracketedCommaSeparatedParams(arr)];
}

export function paramAsFragment(value: unknown): SqlFragment {
	return { sql: "", param: value };
}

export function bracketedCommaSeparatedParams(values: unknown[]): StringOrFragment[] {
	return ["(", ...commaSeparatedFragments(values.map(paramAsFragment)), ")"];
}

export function commaSeparatedFragments(
	items: ReadonlyArray<StringOrFragment | readonly StringOrFragment[]>,
): StringOrFragment[] {
	const result: StringOrFragment[] = [];
	for (let i = 0; i < items.length; i++) {
		if (i > 0) {
			result.push(", ");
		}
		const item = items[i];
		if (Array.isArray(item)) {
			result.push(...item);
		} else {
			result.push(item as StringOrFragment);
		}
	}
	return result;
}

export function bracketedCommaSeparatedFragments(
	items: ReadonlyArray<StringOrFragment | readonly StringOrFragment[]>,
): StringOrFragment[] {
	return ["(", ...commaSeparatedFragments(items), ")"];
}

export function isSqlFragments(value: unknown): value is SqlFragments {
	return (
		value != null &&
		typeof value === "object" &&
		"sqlFragments" in value &&
		Array.isArray(value.sqlFragments)
	);
}
