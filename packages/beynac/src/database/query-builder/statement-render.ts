import type { SqlFragments } from "../Statement.ts";

export function toHumanReadableSql(statement: SqlFragments): string {
	return renderSql(statement, (i) => `[$${i + 1}: ${renderParam(statement.params[i])}]`);
}

export function renderSql(
	{ fragments, params }: SqlFragments,
	renderPlaceholder: (index: number) => string,
): string {
	let result = "";
	for (let i = 0; i < fragments.length; i++) {
		result += fragments[i];
		if (i < params.length) {
			result += renderPlaceholder(i);
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
