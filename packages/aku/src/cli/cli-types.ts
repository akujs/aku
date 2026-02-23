import type { MakeUndefinedOptional } from "../utils.ts";
import type { CliApi } from "./contracts/CliApi.ts";

export interface ArgumentDefinition {
	readonly type: "string" | "number" | "boolean";
	readonly description?: string | undefined;
	readonly positional?: boolean | undefined;
	readonly required?: boolean | undefined;
	readonly array?: boolean | undefined;
	readonly default?: string | number | boolean | string[] | number[] | undefined;
}

export interface ArgumentSchema {
	readonly [name: string]: ArgumentDefinition;
}

type TypeMap = {
	string: string;
	number: number;
	boolean: boolean;
};

type NonEmptyArray<T> = [T, ...T[]];

type BaseType<D extends ArgumentDefinition> = TypeMap[D["type"]];

type IsAlwaysPresent<D extends ArgumentDefinition> = D extends
	| { required: true }
	| { type: "boolean" }
	| { array: true }
	| { default: {} }
	? true
	: false;

type InferArgType<D extends ArgumentDefinition> = D extends { array: true }
	? D extends { required: true }
		? NonEmptyArray<BaseType<D>>
		: BaseType<D>[]
	: IsAlwaysPresent<D> extends true
		? BaseType<D>
		: BaseType<D> | undefined;

export type InferArgs<S extends ArgumentSchema> = MakeUndefinedOptional<{
	-readonly [K in keyof S]: InferArgType<S[K]>;
}>;

export type CommandArgs<C extends { args: ArgumentSchema }> = InferArgs<C["args"]>;

/**
 * Context passed to command execute method.
 */
export interface CommandExecuteContext<A = unknown> {
	args: A;
	cli: CliApi;
}

/**
 * Instance interface for a command.
 */
export interface Command<A = unknown> {
	execute(context: CommandExecuteContext<A>): Promise<void>;
}

/**
 * A command for the CLI. This is the type of a command class, describing its
 * static properties.
 */
export interface CommandDefinition<A = unknown> {
	readonly name: string;
	readonly description: string;
	readonly args?: ArgumentSchema | undefined;
	new (): Command<A>;
}
