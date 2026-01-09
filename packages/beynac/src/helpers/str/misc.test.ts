import { describe, expect, test } from "bun:test";
import { compileMultiReplace } from "./misc.ts";

describe(compileMultiReplace, () => {
	test("replaces single characters", () => {
		const replacer = compileMultiReplace({ a: "1", b: "2" });
		expect(replacer("a + b")).toBe("1 + 2");
	});

	test("replaces multi-character keys", () => {
		const replacer = compileMultiReplace({ ъе: "ye", ый: "iy" });
		expect(replacer("подъезд")).toBe("подyeзд");
		expect(replacer("белый")).toBe("белiy");
	});

	test("prioritises longer keys first", () => {
		// Should match "abc" before "ab" or "a"
		const replacer = compileMultiReplace({ a: "1", ab: "2", abc: "3" });
		expect(replacer("abc")).toBe("3");
		expect(replacer("ab")).toBe("2");
		expect(replacer("a")).toBe("1");
	});

	test("handles regex special characters in keys", () => {
		const replacer = compileMultiReplace({ "*": "star", "+": "plus", ".": "dot" });
		expect(replacer("2 * 3")).toBe("2 star 3");
		expect(replacer("1 + 2")).toBe("1 plus 2");
		expect(replacer("x.y")).toBe("xdoty");
	});

	test("handles all regex meta-characters", () => {
		const replacer = compileMultiReplace({
			"*": "star",
			"+": "plus",
			"?": "question",
			".": "dot",
			"^": "caret",
			$: "dollar",
			"{": "lbrace",
			"}": "rbrace",
			"(": "lparen",
			")": "rparen",
			"|": "pipe",
			"[": "lbracket",
			"]": "rbracket",
			"\\": "backslash",
		});
		expect(replacer("* + ? . ^ $ { } ( ) | [ ] \\")).toBe(
			"star plus question dot caret dollar lbrace rbrace lparen rparen pipe lbracket rbracket backslash",
		);
	});

	test("handles emoji with regex special characters", () => {
		// *️⃣ contains * which is a regex special character
		const replacer = compileMultiReplace({ "*️⃣": "star-emoji", "💯": "100" });
		expect(replacer("*️⃣ 💯")).toBe("star-emoji 100");
	});

	test("handles empty object", () => {
		const replacer = compileMultiReplace({});
		expect(replacer("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		const replacer = compileMultiReplace({ a: "1" });
		expect(replacer("")).toBe("");
	});

	test("replaces all occurrences", () => {
		const replacer = compileMultiReplace({ a: "1" });
		expect(replacer("a a a")).toBe("1 1 1");
	});

	test("preserves characters not in replacement map", () => {
		const replacer = compileMultiReplace({ a: "1" });
		expect(replacer("a b c")).toBe("1 b c");
	});

	test("handles overlapping multi-character sequences correctly", () => {
		// Russian: "ъе" should match before "ъ" or "е"
		const replacer = compileMultiReplace({ ъ: "x", е: "e", ъе: "ye" });
		expect(replacer("подъезд")).toBe("подyeзд"); // ъе→ye
		expect(replacer("объект")).toBe("обyeкт"); // ъе→ye (the word contains ъе)
		expect(replacer("объём")).toBe("обxём"); // ъ→x (followed by ё not е)
	});
});
