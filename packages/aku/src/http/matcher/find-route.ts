import { domainAndPathToSegments, getMatchParams, staticCacheKey } from "./matcher-utils.ts";
import type { MatchedRoute, MatcherContext, MethodData, Node } from "./types.ts";

type FindRouteResult<T> = {
	match?: MatchedRoute<T> | undefined;
	methodMismatch?: boolean | undefined;
	static?: boolean | undefined;
};

export function findRoute<T = unknown>(
	ctx: MatcherContext<T>,
	method: string,
	path: string,
	hostname?: string,
): FindRouteResult<T> {
	if (path.charCodeAt(path.length - 1) === 47 /* '/' */) {
		path = path.slice(0, -1);
	}

	const meta: { methodMismatch?: boolean } = {};

	if (hostname) {
		const domainStatic = checkStaticCache(ctx, hostname, path, method, meta);
		if (domainStatic) {
			return { match: domainStatic, static: true };
		}

		const segments = domainAndPathToSegments(hostname, path);
		const match = _lookupTree<T>(ctx.root, method, segments, 0, meta)?.[0];

		if (match !== undefined) {
			return {
				match: {
					data: match.data,
					params: match.paramsMap ? getMatchParams(segments, match.paramsMap) : undefined,
				},
			};
		}
	}

	const domainAgnosticStatic = checkStaticCache(ctx, undefined, path, method, meta);
	if (domainAgnosticStatic) {
		return { match: domainAgnosticStatic, static: true };
	}

	// Check domain-agnostic tree
	const segments = domainAndPathToSegments(undefined, path);
	const match = _lookupTree<T>(ctx.root, method, segments, 0, meta)?.[0];

	if (match !== undefined) {
		return {
			match: {
				data: match.data,
				params: match.paramsMap ? getMatchParams(segments, match.paramsMap) : undefined,
			},
		};
	}

	return { methodMismatch: meta.methodMismatch };
}

function checkStaticCache<T>(
	ctx: MatcherContext<T>,
	domain: string | undefined,
	path: string,
	method: string,
	meta: { methodMismatch?: boolean },
): MatchedRoute<T> | undefined {
	const cacheKey = staticCacheKey(domain, path);
	const staticNode = ctx.static[cacheKey];

	if (!staticNode || !staticNode.methods) {
		return undefined;
	}

	const staticMatch = staticNode.methods[method] || staticNode.methods[""];
	if (staticMatch) {
		return staticMatch[0];
	}

	meta.methodMismatch = true;
	return undefined;
}

function _lookupTree<T>(
	node: Node<T>,
	method: string,
	segments: string[],
	index: number,
	meta: { methodMismatch?: boolean },
): MethodData<T>[] | undefined {
	// 0. End of path
	if (index === segments.length) {
		if (node.methods) {
			const match = node.methods[method] || node.methods[""];
			if (match) {
				return match;
			}
			// Path found but method doesn't match
			meta.methodMismatch = true;
		}
		// Fallback to dynamic for last child (/test and /test/ matches /test/*)
		if (node.param && node.param.methods) {
			const match = node.param.methods[method] || node.param.methods[""];
			if (match) {
				const pMap = match[0].paramsMap;
				if (pMap?.[pMap?.length - 1]?.[2] /* optional */) {
					return match;
				}
			}
			// Path found but method doesn't match
			meta.methodMismatch = true;
		}
		if (node.wildcard && node.wildcard.methods) {
			const match = node.wildcard.methods[method] || node.wildcard.methods[""];
			if (match) {
				const pMap = match[0].paramsMap;
				if (pMap?.[pMap?.length - 1]?.[2] /* optional */) {
					return match;
				}
			}
			// Path found but method doesn't match
			meta.methodMismatch = true;
		}
		return undefined;
	}

	const segment = segments[index];

	// 1. Static
	if (node.static) {
		const staticChild = node.static[segment];
		if (staticChild) {
			const match = _lookupTree(staticChild, method, segments, index + 1, meta);
			if (match) {
				return match;
			}
		}
	}

	// 2. Param
	if (node.param) {
		const match = _lookupTree(node.param, method, segments, index + 1, meta);
		if (match) {
			if (node.param.hasRegexParam) {
				const exactMatch =
					match.find((m) => m.paramsRegexp[index]?.test(segment)) ||
					match.find((m) => !m.paramsRegexp[index]);
				return exactMatch ? [exactMatch] : undefined;
			}
			return match;
		}
	}

	// 3. Wildcard
	if (node.wildcard && node.wildcard.methods) {
		const match = node.wildcard.methods[method] || node.wildcard.methods[""];
		if (match) {
			return match;
		}
		// Path found but method doesn't match
		meta.methodMismatch = true;
	}

	// No match
	return;
}
