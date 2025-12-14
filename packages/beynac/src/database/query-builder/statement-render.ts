import type { SqlFragments } from "../Statement.ts";

// Render SQL with custom placeholders by interleaving fragments and placeholders
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

export function renderForLogs(fragments: SqlFragments): string {
	return renderSql(fragments, (i) => `[Param#${i + 1}: ${renderParam(fragments.params[i])}]`);
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
