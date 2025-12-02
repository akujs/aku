import type { Statement } from "./contracts/Database.ts";

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Statement {
	const sqlParts: string[] = [];

	for (let i = 0; i < strings.length; i++) {
		sqlParts.push(strings[i]);
		if (i < values.length) {
			sqlParts.push("?");
		}
	}

	return {
		sql: sqlParts.join(""),
		params: values,
	};
}
