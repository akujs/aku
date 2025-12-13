// Render SQL with custom placeholders by interleaving fragments and placeholders
export function renderSql(
	fragments: readonly string[],
	params: unknown[],
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

// Render SQL for logging with parameter values inlined
export function renderForLogs(fragments: readonly string[], params: unknown[]): string {
	return renderSql(fragments, params, (i) => `[Param#${i + 1}: ${renderParam(params[i])}]`);
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
