// Entry point that defines a value (not allowed)
import { BaseClass } from "../../../../../utils.ts";

export class DefinedHere extends BaseClass {}

// Re-exports are fine
export { SourceValue } from "./source.ts";
