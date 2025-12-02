import { describe, expect, test } from "bun:test";
import { jsFrom } from "./js-from.ts";

describe("jsFrom", () => {
	test("serializes simple values", () => {
		expect(jsFrom(42)).toMatchInlineSnapshot(`"(0, eval)("(42)")"`);
		expect(jsFrom("hello")).toMatchInlineSnapshot(`"(0, eval)("(\\"hello\\")")"`);
		expect(jsFrom(true)).toMatchInlineSnapshot(`"(0, eval)("(true)")"`);
		expect(jsFrom(null)).toMatchInlineSnapshot(`"(0, eval)("(null)")"`);
	});

	test("serializes objects and arrays", () => {
		expect(jsFrom({ a: 1, b: 2 })).toMatchInlineSnapshot(`"(0, eval)("({a:1,b:2})")"`);
		expect(jsFrom([1, 2, 3])).toMatchInlineSnapshot(`"(0, eval)("([1,2,3])")"`);
	});

	test("handles circular references and escapes </script> tag", () => {
		// Create an object with circular reference and a dangerous string
		interface TestObj {
			name: string;
			dangerous: string;
			self?: TestObj;
		}
		const obj: TestObj = {
			name: "root",
			dangerous: "This contains </script> which needs escaping",
		};
		obj.self = obj; // circular reference

		const serialized = jsFrom(obj);

		// Verify the serialized output properly escapes the </script> tag
		expect(serialized).toMatchInlineSnapshot(
			`"(0, eval)("((function(a){a.name=\\"root\\";a.dangerous=\\"This contains \\\\u003C/script> which needs escaping\\";a.self=a;return a}({})))")"`,
		);

		const deserialized = eval(serialized) as TestObj;
		expect(deserialized.name).toBe("root");
		expect(deserialized.dangerous).toBe("This contains </script> which needs escaping");
		expect(deserialized.self).toBe(deserialized);
	});
});
