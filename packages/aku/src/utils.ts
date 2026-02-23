export const arrayWrap = <T>(value: T | T[]): T[] => {
	return Array.isArray(value) ? value : [value];
};

export const arrayWrapOptional = <T>(value: T | T[] | null | undefined): T[] =>
	value == null ? [] : arrayWrap(value);

export async function arrayFromAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
	const result: T[] = [];
	for await (const item of iterable) {
		result.push(item);
	}
	return result;
}

export const describeType = (value: unknown): string =>
	value == null ? String(value) : typeof value;

export abstract class BaseClass {
	toString(): string {
		const extra = this.getToStringExtra();
		if (extra) {
			return `[${this.constructor.name} ${extra}]`;
		}
		return `[${this.constructor.name}]`;
	}

	protected getToStringExtra(): string | undefined {
		return undefined;
	}
}

abstract class MultiMap<K, V> extends BaseClass {
	abstract add(key: K, value: V): void;

	addAll(keys: K | K[], values: V | V[]): void {
		for (const key of arrayWrap(keys)) {
			for (const value of arrayWrap(values)) {
				this.add(key, value);
			}
		}
	}
}

type WithoutUndefinedValues<T extends object> = {
	[K in keyof T]: Exclude<T[K], undefined>;
};

export const withoutUndefinedValues = <T extends object>(input: T): WithoutUndefinedValues<T> =>
	Object.fromEntries(
		Object.entries(input).filter((e) => e[1] !== undefined),
	) as WithoutUndefinedValues<T>;

export class SetMultiMap<K, V> extends MultiMap<K, V> {
	#map = new Map<K, Set<V>>();

	add(key: K, value: V): void {
		let set = this.#map.get(key);
		if (!set) {
			set = new Set();
			this.#map.set(key, set);
		}
		set.add(value);
	}

	get(key: K): Iterable<V> {
		const set = this.#map.get(key);
		return set?.values() ?? emptyIterable;
	}

	has(key: K, value: V): boolean {
		return this.#map.get(key)?.has(value) ?? false;
	}

	hasAny(key: K): boolean {
		const set = this.#map.get(key);
		return set !== undefined && set.size > 0;
	}

	delete(key: K, value: V): void {
		const set = this.#map.get(key);
		if (set) {
			set.delete(value);
			if (set.size === 0) {
				this.#map.delete(key);
			}
		}
	}

	deleteAll(key: K): void {
		this.#map.delete(key);
	}

	removeByValue(value: V): void {
		for (const set of this.#map.values()) {
			set.delete(value);
		}
	}

	clear(): void {
		this.#map.clear();
	}
}

const emptyIterable: Iterable<never> = Object.freeze([]);

export class ArrayMultiMap<K, V> extends MultiMap<K, V> {
	#map = new Map<K, V[]>();

	add(key: K, value: V): void {
		let set = this.#map.get(key);
		if (!set) {
			set = [];
			this.#map.set(key, set);
		}
		set.push(value);
	}

	get(key: K): Iterable<V> {
		const set = this.#map.get(key);
		return set?.values() ?? emptyIterable;
	}

	deleteAll(key: K): void {
		this.#map.delete(key);
	}

	clear(): void {
		this.#map.clear();
	}
}

export type MethodNames<T> = {
	[K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export type Prettify<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type MakeUndefinedOptional<T> = {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
	[K in keyof T as undefined extends T[K] ? K : never]?: T[K];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any) => any;

export type AnyConstructor<T = unknown> = abstract new (...args: never[]) => T;

export type NoArgConstructor<T = unknown> = abstract new () => T;

export function getPrototypeChain(instanceOrClass: unknown): AnyConstructor[] {
	const result: AnyConstructor[] = [];

	if (instanceOrClass == null) return result;

	// Start with the appropriate prototype based on input type
	let prototype: unknown =
		typeof instanceOrClass === "function"
			? instanceOrClass.prototype
			: Object.getPrototypeOf(instanceOrClass);

	// Walk up the prototype chain
	while (prototype) {
		const constructor = (prototype as { constructor: AnyConstructor }).constructor;
		if (typeof constructor === "function") {
			result.push(constructor);
		}
		if (prototype === Object.prototype) {
			break;
		}
		prototype = Object.getPrototypeOf(prototype);
	}

	return result;
}

const plural = (word: string): string => word + "s";

export const pluralCount = (count: number, word: string): string =>
	count + " " + (count === 1 ? word : plural(word));

export const mapObjectValues = <K extends string | number | symbol, V, R>(
	obj: Record<K, V>,
	callback: (value: V) => R,
): Record<K, R> => {
	return Object.fromEntries(
		Object.entries(obj).map(([key, value]) => [key, callback(value as V)]),
	) as Record<K, R>;
};

export interface FifoLock<T> {
	acquire(): Promise<T>;
	release(): void;
}

export function fifoLock<T>(resource: T): FifoLock<T> {
	let inUse = false;
	const waiting: Array<() => void> = [];

	return {
		acquire(): Promise<T> {
			if (!inUse) {
				inUse = true;
				return Promise.resolve(resource);
			}
			return new Promise((resolve) => {
				waiting.push(() => resolve(resource));
			});
		},
		release(): void {
			const next = waiting.shift();
			if (next) {
				next();
			} else {
				inUse = false;
			}
		},
	};
}

export class StringKeyWeakMap<T extends object> extends BaseClass {
	#cache = new Map<string, WeakRef<T>>();
	#registry = new FinalizationRegistry<string>((key) => {
		this.#cache.delete(key);
	});

	get(key: string): T | undefined {
		const ref = this.#cache.get(key);
		return ref?.deref();
	}

	set(key: string, value: T): void {
		this.#cache.set(key, new WeakRef(value));
		this.#registry.register(value, key);
	}

	has(key: string): boolean {
		const ref = this.#cache.get(key);
		return ref?.deref() !== undefined;
	}

	delete(key: string): boolean {
		return this.#cache.delete(key);
	}
}
