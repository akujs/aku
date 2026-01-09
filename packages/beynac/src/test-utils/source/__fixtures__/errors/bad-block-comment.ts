import { BaseClass } from "../../../../utils.ts";

export class GoodClass extends BaseClass {
	foo() {
		return 1;
	}
} /** This doc comment is badly placed */
export class AnotherClass extends BaseClass {}

function _helper() {
	return 42;
} /** This doc comment is not followed by an export */
void _helper();

/**
 * First doc comment in a consecutive pair.
 */
/***/
export class ConsecutiveComments extends BaseClass {}

/**
 * This is a properly formatted doc comment with sufficient whitespace.
 */
export class GoodExample extends BaseClass {
	/**
	 * This method doc comment is indented with tabs (should not error).
	 */
	tabIndentedMethod(): void {}
}
