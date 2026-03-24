import { describe, expect, test } from "bun:test";
import { formatOrdinal, stringCompileMultiReplace } from "./misc.ts";

describe(stringCompileMultiReplace, () => {
	test("replaces single characters", () => {
		const replacer = stringCompileMultiReplace({ a: "1", b: "2" });
		expect(replacer("a + b")).toBe("1 + 2");
	});

	test("replaces multi-character keys", () => {
		const replacer = stringCompileMultiReplace({ ъе: "ye", ый: "iy" });
		expect(replacer("подъезд")).toBe("подyeзд");
		expect(replacer("белый")).toBe("белiy");
	});

	test("prioritises longer keys first", () => {
		// Should match "abc" before "ab" or "a"
		const replacer = stringCompileMultiReplace({ a: "1", ab: "2", abc: "3" });
		expect(replacer("abc")).toBe("3");
		expect(replacer("ab")).toBe("2");
		expect(replacer("a")).toBe("1");
	});

	test("handles regex special characters in keys", () => {
		const replacer = stringCompileMultiReplace({ "*": "star", "+": "plus", ".": "dot" });
		expect(replacer("2 * 3")).toBe("2 star 3");
		expect(replacer("1 + 2")).toBe("1 plus 2");
		expect(replacer("x.y")).toBe("xdoty");
	});

	test("handles all regex meta-characters", () => {
		const replacer = stringCompileMultiReplace({
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
		const replacer = stringCompileMultiReplace({ "*️⃣": "star-emoji", "💯": "100" });
		expect(replacer("*️⃣ 💯")).toBe("star-emoji 100");
	});

	test("handles empty object", () => {
		const replacer = stringCompileMultiReplace({});
		expect(replacer("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		const replacer = stringCompileMultiReplace({ a: "1" });
		expect(replacer("")).toBe("");
	});

	test("replaces all occurrences", () => {
		const replacer = stringCompileMultiReplace({ a: "1" });
		expect(replacer("a a a")).toBe("1 1 1");
	});

	test("preserves characters not in replacement map", () => {
		const replacer = stringCompileMultiReplace({ a: "1" });
		expect(replacer("a b c")).toBe("1 b c");
	});

	test("handles overlapping multi-character sequences correctly", () => {
		// Russian: "ъе" should match before "ъ" or "е"
		const replacer = stringCompileMultiReplace({ ъ: "x", е: "e", ъе: "ye" });
		expect(replacer("подъезд")).toBe("подyeзд"); // ъе→ye
		expect(replacer("объект")).toBe("обyeкт"); // ъе→ye (the word contains ъе)
		expect(replacer("объём")).toBe("обxём"); // ъ→x (followed by ё not е)
	});
});

describe(formatOrdinal, () => {
	test("formats numbers", () => {
		expect(formatOrdinal(1)).toBe("1st");
		expect(formatOrdinal(2)).toBe("2nd");
		expect(formatOrdinal(3)).toBe("3rd");
		expect(formatOrdinal(4)).toBe("4th");
		expect(formatOrdinal(5)).toBe("5th");
		expect(formatOrdinal(10)).toBe("10th");
		expect(formatOrdinal(11)).toBe("11th");
		expect(formatOrdinal(12)).toBe("12th");
		expect(formatOrdinal(13)).toBe("13th");
		expect(formatOrdinal(14)).toBe("14th");
		expect(formatOrdinal(21)).toBe("21st");
		expect(formatOrdinal(22)).toBe("22nd");
		expect(formatOrdinal(23)).toBe("23rd");
		expect(formatOrdinal(24)).toBe("24th");
		expect(formatOrdinal(111)).toBe("111th");
		expect(formatOrdinal(112)).toBe("112th");
		expect(formatOrdinal(113)).toBe("113th");
		expect(formatOrdinal(214)).toBe("214th");
		expect(formatOrdinal(221)).toBe("221st");
		expect(formatOrdinal(222)).toBe("222nd");
		expect(formatOrdinal(223)).toBe("223rd");
		expect(formatOrdinal(224)).toBe("224th");

		expect(formatOrdinal(0)).toBe("0th");
		expect(formatOrdinal(-1)).toBe("-1st");
		expect(formatOrdinal(-2)).toBe("-2nd");
		expect(formatOrdinal(-11)).toBe("-11th");
		expect(formatOrdinal(NaN)).toBe("NaNth");
	});
});
