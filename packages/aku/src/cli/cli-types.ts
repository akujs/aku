import type { CommandHandler } from "./Command.ts";
import type { CliApi } from "./contracts/CliApi.ts";

interface ArgumentDefinitionBase {
	readonly description?: string | undefined;
	readonly positional?: boolean | undefined;
	readonly required?: boolean | undefined;
}

export type ArgumentDefinition =
	| (ArgumentDefinitionBase & {
			type: "string";
			array?: false | undefined;
			default?: string | undefined;
	  })
	| (ArgumentDefinitionBase & {
			type: "string";
			array: true;
			default?: readonly string[] | undefined;
	  })
	| (ArgumentDefinitionBase & {
			type: "number";
			array?: false | undefined;
			default?: number | undefined;
	  })
	| (ArgumentDefinitionBase & {
			type: "number";
			array: true;
			default?: readonly number[] | undefined;
	  })
	| (ArgumentDefinitionBase & {
			type: "boolean";
			array?: false | undefined;
			default?: undefined;
	  });

export interface ArgumentSchema {
	readonly [name: string]: ArgumentDefinition;
}

type TypeMap = {
	string: string;
	number: number;
	boolean: boolean;
};

type BaseType<D extends ArgumentDefinition> = TypeMap[D["type"]];

type IsAlwaysPresent<D extends ArgumentDefinition> = D extends
	| { required: true }
	| { type: "boolean" }
	| { array: true }
	| { default: {} }
	? true
	: false;

type InferArgType<D extends ArgumentDefinition> = D extends { array: true }
	? BaseType<D>[]
	: IsAlwaysPresent<D> extends true
		? BaseType<D>
		: BaseType<D> | undefined;

type InferArgsRaw<S extends ArgumentSchema> = { -readonly [K in keyof S]: InferArgType<S[K]> };

export type InferArgs<S extends ArgumentSchema> = {
	[K in keyof InferArgsRaw<S> as undefined extends InferArgsRaw<S>[K]
		? never
		: K]: InferArgsRaw<S>[K];
} & {
	[K in keyof InferArgsRaw<S> as undefined extends InferArgsRaw<S>[K] ? K : never]?: Exclude<
		InferArgsRaw<S>[K],
		undefined
	>;
};

/**
 * Context passed to command execute method.
 */
export interface CommandExecuteContext<A = unknown> {
	args: A;
	cli: CliApi;
}

/**
 * A definition for a CLI command, including its metadata and handler.
 */
export interface CommandDefinition {
	readonly name: string;
	readonly description: string;
	readonly args?: ArgumentSchema | undefined;
	readonly handler: CommandHandler;
}
