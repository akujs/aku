// Imports from an entry point file (not allowed)
import { BaseClass } from "../../../../utils.ts";
import { SourceValue } from "./bad-entry-point/bad-entry-point-entry-point.ts";

export class Importer extends BaseClass {
	value = SourceValue;
}
