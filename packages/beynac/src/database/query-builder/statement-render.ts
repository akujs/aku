import type { SqlFragments } from "../query-types.ts";
import { expandArraysAndSubqueries, getSqlFragmentsParams } from "./statement-utils.ts";

export function toHumanReadableSql(statement: SqlFragments): string {
	const expanded = expandArraysAndSubqueries(statement);
	const params = getSqlFragmentsParams(expanded);
	let paramIndex = 0;
	return renderSqlFragments(expanded, () => {
		const param = params[paramIndex];
		return `[$${++paramIndex}: ${renderParam(param)}]`;
	});
}

export function renderSqlFragments(
	statement: SqlFragments,
	renderPlaceholder: (index: number) => string,
): string {
	let result = "";
	let paramIndex = 0;

	for (const item of statement.sqlFragments) {
		const sql = typeof item === "string" ? item : item.sql;

		const prevEndsWithSpace = /\s$/.test(result);
		const nextStartsWithSpace = /^\s/.test(sql);
		const nextStartsWithComma = sql.startsWith(",");
		if (result && !prevEndsWithSpace && !nextStartsWithSpace && !nextStartsWithComma) {
			result += " ";
		}

		if (typeof item === "string") {
			result += item;
		} else {
			result += item.sql + renderPlaceholder(paramIndex++);
		}
	}

	return result;
}

function renderParam(value: unknown): string {
	let str = "";
	try {
		str = JSON.stringify(value);
	} catch {}
	str ||= String(value);

	const maxLength = 100;

	if (str.length > maxLength + 30) {
		const hidden = str.length - maxLength;
		return `${str.slice(0, maxLength)}...hiding ${hidden} more chars`;
	}
	return str;
}
