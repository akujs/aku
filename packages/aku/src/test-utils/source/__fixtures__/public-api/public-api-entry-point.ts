// Entry point - re-exports public API items

export {
	DOCUMENTED_CONST,
	DocumentedClass,
	type DocumentedInterface,
	type DocumentedType,
	documentedFunction,
} from "./documented.ts";
export { overloadedFunction } from "./function-overloads.ts";
export { SharedName } from "./type-value-same-name.ts";
export {
	UNDOCUMENTED_CONST,
	UndocumentedClass,
	type UndocumentedInterface,
	type UndocumentedType,
	undocumentedFunction,
} from "./undocumented.ts";

// Note: internal.ts exports are NOT re-exported here
