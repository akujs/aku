import { type ParseArgsOptionsConfig, parseArgs } from "node:util";
import { kebabCase } from "../helpers/str/case.ts";
import { ordinal } from "../helpers/str/misc.ts";
import { type Prettify, withoutUndefinedValues } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { ArgumentDefinition, ArgumentSchema, InferArgs } from "./cli-types.ts";

type ProcessedDef = ArgumentDefinition & {
	name: string;
	argumentName: string;
	index: number;
};

interface AnalysedSchema {
	defs: ProcessedDef[];
	parseArgsOptions: ParseArgsOptionsConfig;
}

export function parseArguments<S extends ArgumentSchema>(
	argv: string[],
	schema: S | undefined,
): Prettify<InferArgs<S>> {
	const { defs, parseArgsOptions } = processSchema(schema ?? {});

	validateDefs(defs);

	rejectBooleanValues(argv, defs);

	const { values, positionals } = parseArgs({
		args: argv,
		options: parseArgsOptions,
		allowPositionals: true,
		strict: false,
	});

	validateValues(defs, values);

	const result: Record<string, unknown> = {};

	const namedDefs = defs.filter((def) => !def.positional);
	mapPositionals(defs, positionals, result);
	mapNamed(namedDefs, values, result);

	return result as Prettify<InferArgs<S>>;
}

function processSchema(schema: ArgumentSchema): AnalysedSchema {
	const defs = Object.entries(schema).map(
		([name, rawDef], index): ProcessedDef => ({
			...rawDef,
			name,
			argumentName: rawDef.positional ? name : kebabCase(name),
			index,
			required: rawDef.default !== undefined ? false : rawDef.required,
		}),
	);

	const parseArgsOptions: ParseArgsOptionsConfig = {};
	for (const def of defs) {
		if (!def.positional) {
			parseArgsOptions[def.argumentName] = withoutUndefinedValues({
				type: def.type === "boolean" ? "boolean" : "string",
				multiple: def.array,
			});
		}
	}

	return { defs, parseArgsOptions };
}

function rejectBooleanValues(argv: string[], defs: ProcessedDef[]): void {
	const booleanDefs = defs.filter((def) => !def.positional && def.type === "boolean");
	const booleanArgumentNames = new Set(booleanDefs.map((def) => def.argumentName));

	for (const arg of argv) {
		const longMatch = arg.match(/^--([^=]+)=(.+)$/);
		if (longMatch) {
			const [, argumentName] = longMatch;
			if (booleanArgumentNames.has(argumentName)) {
				throw new CliExitError(
					`Option '--${argumentName}' is a boolean flag and does not accept a value. Use '--${argumentName}' to enable.`,
				);
			}
		}
	}
}

function validateDefs(defs: ProcessedDef[]): void {
	const helpArg = defs.find((def) => def.name === "help");
	if (helpArg) {
		throw new Error(
			'Invalid argument schema: "help" is a reserved argument name (--help is used for displaying command help).',
		);
	}

	const booleanArray = defs.find((def) => def.type === "boolean" && def.array);
	if (booleanArray) {
		throw new Error(
			`Invalid argument schema: boolean array arguments are not supported (${booleanArray.name}).`,
		);
	}

	const booleanPositional = defs.find((def) => def.type === "boolean" && def.positional);
	if (booleanPositional) {
		throw new Error(
			`Invalid argument schema: boolean positional arguments are not supported (${booleanPositional.name}).`,
		);
	}

	for (const def of defs) {
		if (def.type === "boolean" && (def as unknown as { default: unknown }).default !== undefined) {
			throw new Error(
				`Invalid argument schema: boolean arguments do not support defaults (${def.name}). Booleans are always false when absent.`,
			);
		}
	}

	const positionals = defs.filter((def) => def.positional);
	const firstArray = positionals.find((def) => def.array);

	if (firstArray && firstArray !== positionals.at(-1)) {
		throw new Error(
			`Invalid argument schema: array positional argument (${firstArray.name}) must be the last positional argument.`,
		);
	}

	const firstOptional = positionals.find((def) => !def.required && !def.array);
	if (firstOptional && firstArray) {
		throw new Error(
			`Invalid argument schema: can't mix array positional arguments (${firstArray.name}) and optional (${firstOptional.name}) positional arguments.`,
		);
	}

	const lastRequired = positionals.findLast((def) => def.required);
	if (firstOptional && lastRequired && lastRequired.index > firstOptional.index) {
		throw new Error(
			`Invalid argument schema: required positional argument "${lastRequired.name}" cannot follow optional positional argument "${firstOptional.name}".`,
		);
	}
}

function validateValues(defs: ProcessedDef[], values: Record<string, unknown>): void {
	const namedDefs = defs.filter((def) => !def.positional);
	const knownArgumentNames = new Set(namedDefs.map((def) => def.argumentName));

	const unknownOption = Object.keys(values).find(
		(argumentName) => !knownArgumentNames.has(argumentName),
	);
	if (unknownOption) {
		throw new CliExitError(`Unknown option: --${unknownOption}`);
	}

	const missingValue = namedDefs.find(
		(def) => values[def.argumentName] === true && def.type !== "boolean",
	);
	if (missingValue) {
		throw new CliExitError(`Option '--${missingValue.argumentName}' requires a value`);
	}
}

function mapPositionals(
	defs: ProcessedDef[],
	positionals: string[],
	result: Record<string, unknown>,
): void {
	const remaining = [...positionals];

	for (const def of defs) {
		if (!def.positional) continue;

		const hasDefault = def.default !== undefined;

		// Variadic arrays: consume all remaining (validated to be last)
		if (def.array) {
			if (def.required && !hasDefault && remaining.length === 0) {
				throw new CliExitError(`Missing required argument: ${def.name}`);
			}
			result[def.name] =
				remaining.length > 0
					? remaining.map((v) => convertValue(v, def.type as "string" | "number"))
					: (def.default ?? []);
			return;
		}

		const value = remaining.shift();

		// Strings and numbers
		if (def.required && !hasDefault && value === undefined) {
			throw new CliExitError(`Missing required argument: ${def.name}`);
		}
		if (value !== undefined) {
			result[def.name] = convertValue(value, def.type as "string" | "number");
		} else if (hasDefault) {
			result[def.name] = def.default;
		}
		// If no value and no default, property is simply not set
	}

	if (remaining.length > 0) {
		const index = positionals.length - remaining.length;
		throw new CliExitError(
			`Unexpected ${ordinal(index + 1)} positional argument ${JSON.stringify(remaining[0])}`,
		);
	}
}

function mapNamed(
	namedDefs: ProcessedDef[],
	values: Record<string, unknown>,
	result: Record<string, unknown>,
): void {
	for (const def of namedDefs) {
		const value = values[def.argumentName] ?? def.default;

		// Booleans: presence check only (--flag means true, absent means false)
		if (def.type === "boolean") {
			result[def.name] = value === true;
			continue;
		}

		// Arrays
		if (def.array) {
			if (value === undefined) {
				if (def.required) {
					throw new CliExitError(`Missing required option: --${def.argumentName}`);
				}
				result[def.name] = [];
			} else if (Array.isArray(value)) {
				result[def.name] = value.map((v) => convertValue(v, def.type));
			}
			continue;
		}

		if (def.required && value === undefined) {
			throw new CliExitError(`Missing required option: --${def.argumentName}`);
		}

		if (value === undefined) {
			continue;
		}

		result[def.name] = convertValue(value, def.type);
	}
}

function convertValue(value: unknown, type: "string" | "number"): string | number {
	if (type === "number") {
		const num = Number(value);
		if (Number.isNaN(num)) {
			throw new CliExitError(`Invalid number: "${String(value)}"`);
		}
		return num;
	}
	return String(value);
}
