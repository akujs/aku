import { pluralCount } from "../../utils.ts";
import { isSqlFragments, type SqlFragment, SqlFragments } from "../Statement.ts";

export function getSqlFragmentsParams(statement: SqlFragments): unknown[] {
	const result: unknown[] = [];
	for (const item of statement.sqlFragments) {
		if (typeof item !== "string") {
			result.push(item.param);
		}
	}
	return result;
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
		return new SqlFragments([sql]);
	}

	const items: (string | SqlFragment)[] = [];

	for (let i = 0; i < values.length; i++) {
		items.push({ sql: parts[i], param: values[i] });
	}

	const lastPart = parts[parts.length - 1];
	if (lastPart) {
		items.push(lastPart);
	}

	return new SqlFragments(items);
}

export function expandArraysAndSubqueries(statement: SqlFragments): SqlFragments {
	const result: (string | SqlFragment)[] = [];

	for (const item of statement.sqlFragments) {
		if (typeof item === "string") {
			result.push(item);
			continue;
		}

		const { sql, param } = item;

		if (isSqlFragments(param)) {
			result.push(...expandSubquery(sql, param));
		} else if (Array.isArray(param) && /\bIN\s*\(?\s*$/i.test(sql)) {
			result.push(...expandArrayParam(sql, param));
		} else {
			result.push(item);
		}
	}

	return new SqlFragments(result);
}

function expandSubquery(precedingSql: string, subquery: SqlFragments): (string | SqlFragment)[] {
	const expanded = expandArraysAndSubqueries(subquery);
	return [precedingSql, "(", ...expanded.sqlFragments, ")"];
}

function expandArrayParam(precedingSql: string, arr: unknown[]): (string | SqlFragment)[] {
	const hasUserParen = precedingSql.trim().endsWith("(");
	if (arr.length === 0) {
		// Empty array: use IN (NULL) - never matches
		return [precedingSql, hasUserParen ? "NULL" : "(NULL)"];
	}

	const items: (string | SqlFragment)[] = [precedingSql];

	if (!hasUserParen) items.push("(");
	for (let i = 0; i < arr.length; i++) {
		items.push({ sql: "", param: arr[i] });
		if (i < arr.length - 1) {
			items.push(",");
		}
	}
	if (!hasUserParen) items.push(")");

	return items;
}
