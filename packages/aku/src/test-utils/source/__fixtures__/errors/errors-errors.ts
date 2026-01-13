import { AkuError } from "../../../../core/core-errors.ts";
import { BaseClass } from "../../../../utils.ts";

// Good: ends with Error and extends AkuError
export class GoodError extends AkuError {
	constructor() {
		super("good error");
	}
}

// Good: doesn't end with Error, extends BaseClass
export class RegularClass extends BaseClass {}

// Bad: ends with Error but doesn't extend AkuError
export class FooError extends BaseClass {}

// Bad: not re-exported from the root errors.ts
export class NotInRootErrorsError extends AkuError {}

// Bad: not re-exported from the root errors.ts
export class NotInLocalErrorsError extends AkuError {}

// Bad: extends AkuError but doesn't end with Error
export class BadErrorExtension extends AkuError {
	constructor() {
		super("bad extension");
	}
}
