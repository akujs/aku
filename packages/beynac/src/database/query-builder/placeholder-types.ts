type CountPlaceholders<S extends string> = S extends `${string}?${infer Rest}`
	? [1, ...CountPlaceholders<Rest>]
	: [];

type NTuple<N extends number, T = unknown, Acc extends T[] = []> = Acc["length"] extends N
	? Acc
	: NTuple<N, T, [...Acc, T]>;

// For a SQL string with `?` placeholders, returns the required argument types.
export type PlaceholderArgs<S extends string> = string extends S
	? unknown[]
	: NTuple<CountPlaceholders<S>["length"]>;
