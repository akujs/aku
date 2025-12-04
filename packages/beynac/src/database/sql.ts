import type { Statement } from "./contracts/Database.ts";

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Statement {
	return {
		fragments: strings,
		params: values,
	};
}

export function renderStatementSql(
	statement: Statement,
	renderPlaceholder: (index: number) => string,
): string {
	const { fragments, params } = statement;
	let result = "";
	for (let i = 0; i < fragments.length; i++) {
		result += fragments[i];
		if (i < params.length) {
			result += renderPlaceholder(i);
		}
	}
	return result;
}

export function renderStatementForLogs(statement: Statement): string {
	return renderStatementSql(
		statement,
		(i) => `[Param#${i + 1}: ${renderParam(statement.params[i])}]`,
	);
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
