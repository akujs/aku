import { type ParseArgsOptionsConfig, parseArgs } from "node:util";
import { ordinal } from "../helpers/str/misc.ts";
import { type Prettify, withoutUndefinedValues } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { ArgumentDefinition, ArgumentSchema, InferArgs } from "./cli-types.ts";

interface ProcessedDef extends ArgumentDefinition {
	name: string;
	index: number;
}

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

	// Extract --boolFlag=value patterns before parseArgs (which doesn't support them)
	const { processedArgv, booleanValues } = preprocessBooleanValues(argv, defs);

	const { values, positionals } = parseArgs({
		args: processedArgv,
		options: parseArgsOptions,
		allowPositionals: true,
		strict: false,
	});

	// Merge extracted boolean values back
	for (const [name, value] of Object.entries(booleanValues)) {
		values[name] = value;
	}

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
			index,
			required: rawDef.default !== undefined ? false : rawDef.required,
		}),
	);

	const parseArgsOptions: ParseArgsOptionsConfig = {};
	for (const def of defs) {
		if (!def.positional) {
			parseArgsOptions[def.name] = withoutUndefinedValues({
				type: def.type === "boolean" ? "boolean" : "string",
				multiple: def.array,
			});
		}
	}

	return { defs, parseArgsOptions };
}

interface PreprocessResult {
	processedArgv: string[];
	booleanValues: Record<string, boolean>;
}

function preprocessBooleanValues(argv: string[], defs: ProcessedDef[]): PreprocessResult {
	const booleanDefs = defs.filter((def) => !def.positional && def.type === "boolean");
	const booleanNames = new Set(booleanDefs.map((def) => def.name));

	const processedArgv: string[] = [];
	const booleanValues: Record<string, boolean> = {};

	for (const arg of argv) {
		// Match --name=value
		const longMatch = arg.match(/^--([^=]+)=(.+)$/);
		if (longMatch) {
			const [, name, value] = longMatch;
			if (booleanNames.has(name)) {
				booleanValues[name] = convertValue(value, "boolean") as boolean;
				continue;
			}
		}

		processedArgv.push(arg);
	}

	return { processedArgv, booleanValues };
}

function validateDefs(defs: ProcessedDef[]): void {
	const booleanArray = defs.find((def) => def.type === "boolean" && def.array);
	if (booleanArray) {
		throw new Error(
			`Invalid argument schema: boolean array arguments are not supported (${booleanArray.name}).`,
		);
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
	const knownNames = new Set(namedDefs.map((def) => def.name));

	const unknownOption = Object.keys(values).find((name) => !knownNames.has(name));
	if (unknownOption) {
		throw new CliExitError(`Unknown option: --${unknownOption}`);
	}

	const missingValue = namedDefs.find((def) => values[def.name] === true && def.type !== "boolean");
	if (missingValue) {
		throw new CliExitError(`Option '--${missingValue.name}' requires a value`);
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
					? remaining.map((v) => convertValue(v, def.type))
					: (def.default ?? []);
			return;
		}

		const value = remaining.shift();

		// Booleans always have a value (default to false)
		if (def.type === "boolean") {
			result[def.name] =
				value !== undefined ? convertValue(value, def.type) : (def.default ?? false);
			continue;
		}

		// Strings and numbers
		if (def.required && !hasDefault && value === undefined) {
			throw new CliExitError(`Missing required argument: ${def.name}`);
		}
		if (value !== undefined) {
			result[def.name] = convertValue(value, def.type);
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
		const value = values[def.name] ?? def.default;

		// Booleans default to false when absent (required is ignored for booleans)
		if (def.type === "boolean") {
			if (value === undefined) {
				result[def.name] = false;
			} else if (value === true) {
				// --flag without value sets boolean true directly
				result[def.name] = true;
			} else {
				result[def.name] = convertValue(value, def.type);
			}
			continue;
		}

		// Arrays
		if (def.array) {
			if (value === undefined) {
				if (def.required) {
					throw new CliExitError(`Missing required option: --${def.name}`);
				}
				result[def.name] = [];
			} else if (Array.isArray(value)) {
				result[def.name] = value.map((v) => convertValue(v, def.type));
			}
			continue;
		}

		if (def.required && value === undefined) {
			throw new CliExitError(`Missing required option: --${def.name}`);
		}

		if (value === undefined) {
			continue;
		}

		result[def.name] = convertValue(value, def.type);
	}
}

function convertValue(
	value: unknown,
	type: "string" | "number" | "boolean",
): string | number | boolean {
	if (type === "number") {
		const num = Number(value);
		if (Number.isNaN(num)) {
			throw new CliExitError(`Invalid number: "${String(value)}"`);
		}
		return num;
	}
	if (type === "boolean") {
		const str = String(value).toLowerCase();
		if (str === "false" || str === "0" || str === "no" || str === "n") {
			return false;
		}
		if (str === "true" || str === "yes" || str === "y") {
			return true;
		}
		// Check for non-zero number
		const num = Number(value);
		if (!Number.isNaN(num) && num !== 0) {
			return true;
		}
		throw new CliExitError(
			`Invalid boolean: "${String(value)}". Use true/false, yes/no, y/n, or 0/1.`,
		);
	}
	return String(value);
}
