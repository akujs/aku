import { BeynacError } from "../../../../core/core-errors.ts";
import { BaseClass } from "../../../../utils.ts";

// Good: ends with Error and extends BeynacError
export class GoodError extends BeynacError {
	constructor() {
		super("good error");
	}
}

// Good: doesn't end with Error, extends BaseClass
export class RegularClass extends BaseClass {}

// Bad: ends with Error but doesn't extend BeynacError
export class FooError extends BaseClass {}

// Bad: not re-exported from the root errors.ts
export class NotInRootErrorsError extends BeynacError {}

// Bad: not re-exported from the root errors.ts
export class NotInLocalErrorsError extends BeynacError {}

// Bad: extends BeynacError but doesn't end with Error
export class BadErrorExtension extends BeynacError {
	constructor() {
		super("bad extension");
	}
}
