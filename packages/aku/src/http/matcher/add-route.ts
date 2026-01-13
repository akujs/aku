import { PARAM_PATTERN, WILDCARD_PARAM_PATTERN } from "../syntax.ts";
import { domainAndPathToSegments, NullProtoObj, staticCacheKey } from "./matcher-utils.ts";
import type { MatcherContext, ParamsIndexMap } from "./types.ts";

export function addRoute<T>(
	ctx: MatcherContext<T>,
	method: string,
	path: string,
	data?: T,
	domain?: string,
): void {
	method = method.toUpperCase();
	if (path.charCodeAt(0) !== 47 /* '/' */) {
		path = `/${path}`;
	}

	const segments = domainAndPathToSegments(domain, path);

	let node = ctx.root;

	const paramsMap: ParamsIndexMap = [];
	const paramsRegexp: RegExp[] = [];

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];

		// Wildcard: {...param}
		const wildcardMatch = segment.match(WILDCARD_PARAM_PATTERN);
		if (wildcardMatch) {
			if (!node.wildcard) {
				node.wildcard = { key: "**" };
			}
			node = node.wildcard;
			const paramName = wildcardMatch[0].slice(4, -1); // Extract from {...name}
			paramsMap.push([-i, paramName, true /* optional - wildcards can match empty paths */]);
			break;
		}

		// Param: {param} or mixed like @{param}
		const paramMatch = segment.match(PARAM_PATTERN);
		if (paramMatch) {
			if (!node.param) {
				node.param = { key: "*" };
			}
			node = node.param;

			// Check if segment has params mixed with literal text (e.g., @{param} or {id}.txt)
			// This happens when the matched param doesn't consume the entire segment
			const isFullSegmentParam = paramMatch.length === 1 && paramMatch[0] === segment;

			if (!isFullSegmentParam) {
				// Mixed segment: create regex to match literal parts and extract params
				const regexp = getParamRegexp(segment);
				paramsRegexp[i] = regexp;
				node.hasRegexParam = true;
				paramsMap.push([i, regexp, false]);
			} else {
				// Simple param: entire segment is the param
				const paramName = paramMatch[0].slice(1, -1); // Extract from {name}
				paramsMap.push([i, paramName, false]);
			}
			continue;
		}

		// Static
		const child = node.static?.[segment];
		if (child) {
			node = child;
		} else {
			const staticNode = { key: segment };
			if (!node.static) {
				node.static = new NullProtoObj();
			}
			node.static![segment] = staticNode;
			node = staticNode;
		}
	}

	// Assign index, params and data to the node
	const hasParams = paramsMap.length > 0;
	if (!node.methods) {
		node.methods = new NullProtoObj();
	}
	node.methods![method] ??= [];
	node.methods![method]!.push({
		data: data || (null as T),
		paramsRegexp,
		paramsMap: hasParams ? paramsMap : undefined,
	});

	// Static cache
	if (!hasParams) {
		ctx.static[staticCacheKey(domain, path)] = node;
	}
}

function getParamRegexp(segment: string): RegExp {
	const regex = segment.replace(/\{(\w+)\}/g, (_, id) => `(?<${id}>[^/]+)`).replace(/\./g, "\\.");
	return new RegExp(`^${regex}$`);
}
