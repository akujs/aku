// Entry point - re-exports public API items

export {
	DOCUMENTED_CONST,
	DocumentedClass,
	type DocumentedInterface,
	type DocumentedType,
	documentedFunction,
} from "../public-api/documented.ts";
export { overloadedFunction } from "../public-api/function-overloads.ts";
export { SharedName } from "../public-api/type-value-same-name.ts";
export {
	UNDOCUMENTED_CONST,
	UndocumentedClass,
	type UndocumentedInterface,
	type UndocumentedType,
	undocumentedFunction,
} from "../public-api/undocumented.ts";

// Note: internal.ts exports are NOT re-exported here
