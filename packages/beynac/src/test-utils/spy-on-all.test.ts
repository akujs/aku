import { describe, expect, test } from "bun:test";
import { spyOnAll } from "./spy-on-all.ts";

describe(spyOnAll, () => {
	test("spies on all methods of an object including prototype methods", () => {
		class TestClass {
			protoMethod() {
				return "proto";
			}
			instanceMethod = () => "instance";
		}

		const obj = new TestClass();
		spyOnAll(obj);

		// Call the methods
		obj.protoMethod();
		obj.instanceMethod();

		// Check that spies were created
		expect(obj.protoMethod).toHaveBeenCalled();
		expect(obj.instanceMethod).toHaveBeenCalled();
	});
});
