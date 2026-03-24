import { describe, expect, test } from "bun:test";
import { findSimilar, levenshteinDistance } from "./similarity.ts";

describe(levenshteinDistance, () => {
	// Test vectors from sindresorhus/leven (MIT)
	const vectors: Array<[string, string, number]> = [
		["", "", 0],
		["a", "b", 1],
		["ab", "ac", 1],
		["ac", "bc", 1],
		["abc", "axc", 1],
		["cat", "cow", 2],
		["kitten", "sitting", 3],
		["example", "samples", 3],
		["distance", "difference", 5],
		["xabxcdxxefxgx", "abcdefg", 6],
		["xabxcdxxefxgx", "1ab2cd34ef5g6", 6],
		["sturgeon", "urgently", 6],
		["levenshtein", "frankenstein", 6],
		["javawasneat", "scalaisgreat", 7],
		["因為我是中國人所以我會說中文", "因為我是英國人所以我會說英文", 2],
		["hello", "", 5],
		["", "hello", 5],
	];

	test.each(vectors)("%s vs %s → %i", (a, b, expected) => {
		expect(levenshteinDistance(a, b)).toBe(expected);
	});

	const maxDistanceVectors: Array<[string, string, number, number]> = [
		["abcdef", "123456", 3, 3],
		["abcdef", "abcdefg", 3, 1],
		["kitten", "sitting", 2, 2],
		["cat", "cow", 5, 2],
		["same", "same", 1, 0],
		["a", "abcdefgh", 3, 3],
		["short", "muchlongerstringhere", 5, 5],
		["", "abc", 2, 2],
		["", "abc", 10, 3],
		["abc", "", 2, 2],
		["abc", "abc", 0, 0],
	];

	test.each(maxDistanceVectors)("%s vs %s (maxDistance %i) → %i", (a, b, maxDistance, expected) => {
		expect(levenshteinDistance(a, b, { maxDistance })).toBe(expected);
	});
});

describe(findSimilar, () => {
	test("finds basic typo matches", () => {
		expect(findSimilar("migrat", ["migrate", "serve", "list"])).toEqual(["migrate"]);
	});

	test("returns multiple matches sorted by distance", () => {
		const result = findSimilar("test", ["tset", "testing", "best", "zzzzz"]);
		expect(result[0]).toBe("best");
		expect(result[1]).toBe("tset");
		expect(result).toContain("testing");
	});

	test("returns exact match first", () => {
		const result = findSimilar("serve", ["serve", "server", "sever"]);
		expect(result[0]).toBe("serve");
	});

	test("returns empty array when no matches within threshold", () => {
		expect(findSimilar("xyz", ["abcdefgh", "ijklmnop"])).toEqual([]);
	});

	test("returns empty array for empty candidates", () => {
		expect(findSimilar("hello", [])).toEqual([]);
	});

	test("respects custom threshold", () => {
		expect(findSimilar("cat", ["car", "cab", "completely"], { threshold: 1 })).toEqual([
			"cab",
			"car",
		]);
	});

	test("respects custom maxResults", () => {
		const result = findSimilar("test", ["best", "rest", "nest", "fest"], { maxResults: 2 });
		expect(result).toHaveLength(2);
	});

	test("uses alphabetical tie-breaking for equal distances", () => {
		const result = findSimilar("test", ["best", "nest", "fest", "rest"]);
		expect(result).toEqual(["best", "fest", "nest"]);
	});
});
