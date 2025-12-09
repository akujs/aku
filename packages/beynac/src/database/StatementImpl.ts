import { BaseClass } from "../utils.ts";
import type { Statement } from "./Statement.ts";

// Implementation of the Statement interface.
export class StatementImpl extends BaseClass implements Statement {
	readonly fragments: readonly string[];
	readonly params: unknown[];

	constructor(fragments: readonly string[], params: unknown[]) {
		super();
		this.fragments = fragments;
		this.params = params;
	}

	renderSql(renderPlaceholder: (index: number) => string): string {
		const { fragments, params } = this;
		let result = "";
		for (let i = 0; i < fragments.length; i++) {
			result += fragments[i];
			if (i < params.length) {
				result += renderPlaceholder(i);
			}
		}
		return result;
	}

	renderForLogs(): string {
		return this.renderSql((i) => `[Param#${i + 1}: ${renderParam(this.params[i])}]`);
	}
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
