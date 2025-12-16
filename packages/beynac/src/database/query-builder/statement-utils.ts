import type { SqlFragments } from "../Statement.ts";

// Convert a SQL string with `?` placeholders and values into SqlFragments.
// Handles Statement values (inlined as subqueries), arrays (expanded to placeholders),
// and regular values (added as parameters). Uses naive `?` splitting to match
// compile-time arity checking.
export function toStatement(sql: string, values: unknown[]): SqlFragments {
	const parts = sql.split("?");
	const expectedCount = parts.length - 1;

	if (expectedCount !== values.length) {
		throw new Error(
			`SQL placeholder count mismatch: expected ${expectedCount} value${expectedCount === 1 ? "" : "s"}, got ${values.length}`,
		);
	}

	// No placeholders - simple case
	if (values.length === 0) {
		return { fragments: [sql], params: [] };
	}

	const fragments: string[] = [parts[0]];
	const params: unknown[] = [];

	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		const nextPart = parts[i + 1];

		if (isStatement(value)) {
			inlineSubquery(fragments, params, value, nextPart);
		} else if (Array.isArray(value)) {
			expandArray(fragments, params, value, nextPart);
		} else {
			params.push(value);
			fragments.push(nextPart);
		}
	}

	return { fragments, params };
}

export function mergeFragments(
	...parts: Array<string | SqlFragments | null | undefined>
): SqlFragments {
	const filtered = parts.filter((p): p is string | SqlFragments => !!p);

	if (filtered.length === 0) {
		return { fragments: [""], params: [] };
	}

	const fragments: string[] = [];
	const params: unknown[] = [];

	for (let i = 0; i < filtered.length; i++) {
		const part = filtered[i];
		const partFragments = typeof part === "string" ? [part] : part.fragments;
		const partParams = typeof part === "string" ? [] : part.params;

		if (i === 0) {
			fragments.push(...partFragments);
			params.push(...partParams);
		} else {
			// Add space then concatenate first fragment of this part to last fragment of accumulated
			fragments[fragments.length - 1] += " " + partFragments[0];
			for (let j = 1; j < partFragments.length; j++) {
				fragments.push(partFragments[j]);
			}
			params.push(...partParams);
		}
	}

	return { fragments, params };
}

// Join conditions with AND, wrapping each in parentheses.
// Returns a single SqlFragments: (cond1) AND (cond2) AND (cond3)
export function andClause(conditions: SqlFragments[]): SqlFragments {
	if (conditions.length === 0) {
		return { fragments: [""], params: [] };
	}

	const fragments: string[] = ["("];
	const params: unknown[] = [];

	for (let i = 0; i < conditions.length; i++) {
		const cond = conditions[i];

		if (i > 0) {
			fragments[fragments.length - 1] += " AND (";
		}

		// Append condition fragments
		fragments[fragments.length - 1] += cond.fragments[0];
		for (let j = 1; j < cond.fragments.length; j++) {
			fragments.push(cond.fragments[j]);
		}
		params.push(...cond.params);

		// Close paren
		fragments[fragments.length - 1] += ")";
	}

	return { fragments, params };
}

function isStatement(value: unknown): value is SqlFragments {
	return (
		value !== null &&
		typeof value === "object" &&
		"fragments" in value &&
		"params" in value &&
		Array.isArray((value as SqlFragments).fragments) &&
		Array.isArray((value as SqlFragments).params)
	);
}

function inlineSubquery(
	fragments: string[],
	params: unknown[],
	sub: SqlFragments,
	nextPart: string,
): void {
	// Append opening paren and first subfragment to the last accumulated fragment
	fragments[fragments.length - 1] += "(" + sub.fragments[0];

	// Add subfragment/param pairs
	for (let i = 0; i < sub.params.length; i++) {
		params.push(sub.params[i]);
		fragments.push(sub.fragments[i + 1]);
	}

	// Append closing paren and the next part to the last fragment
	fragments[fragments.length - 1] += ")" + nextPart;
}

function expandArray(
	fragments: string[],
	params: unknown[],
	arr: unknown[],
	nextPart: string,
): void {
	const lastFragment = fragments[fragments.length - 1];

	// Detect if we're in an IN expression: "IN ?" or "IN (?)"
	const isInExpression = /\bIN\s*\(?\s*$/i.test(lastFragment);

	if (!isInExpression) {
		// Outside IN context: pass array through as-is, let driver handle it
		params.push(arr);
		fragments.push(nextPart);
		return;
	}

	// Check if user provided the opening paren
	const hasUserParen = lastFragment.trim().endsWith("(");

	if (arr.length === 0) {
		// Empty array in IN context: use NULL (which never matches anything)
		// If user provided paren (IN (?)), just emit NULL
		// If no user paren (IN ?), emit (NULL)
		fragments[fragments.length - 1] += (hasUserParen ? "NULL" : "(NULL)") + nextPart;
	} else {
		// Non-empty: expand elements as params
		// Add opening paren only if user didn't provide one
		if (!hasUserParen) {
			fragments[fragments.length - 1] += "(";
		}
		for (let i = 0; i < arr.length; i++) {
			params.push(arr[i]);
			if (i < arr.length - 1) {
				fragments.push(", ");
			}
		}
		// Add closing paren only if user didn't provide opening paren
		// (if they provided opening, nextPart will contain their closing paren)
		fragments.push((hasUserParen ? "" : ")") + nextPart);
	}
}
