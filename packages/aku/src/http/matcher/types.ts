export interface MatcherContext<T = unknown> {
	root: Node<T>;
	static: Record<string, Node<T> | undefined>;
}

export type ParamsIndexMap = Array<[Index: number, name: string | RegExp, optional: boolean]>;
export type MethodData<T = unknown> = {
	data: T;
	paramsMap?: ParamsIndexMap | undefined;
	paramsRegexp: RegExp[];
};

export interface Node<T = unknown> {
	key: string;

	static?: Record<string, Node<T>> | undefined;
	param?: Node<T> | undefined;
	wildcard?: Node<T> | undefined;

	hasRegexParam?: boolean | undefined;

	methods?: Record<string, MethodData<T>[] | undefined> | undefined;
}

export type MatchedRoute<T = unknown> = {
	data: T;
	params?: Record<string, string> | undefined;
};
