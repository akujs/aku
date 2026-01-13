import { beforeEach, describe, expect, test } from "bun:test";
import { mockMiddleware } from "../test-utils/http-test-utils.bun.ts";
import { MiddlewarePriorityBuilder } from "./MiddlewarePriorityBuilder.ts";

// Test middleware classes
const M1 = mockMiddleware("M1");
const M2 = mockMiddleware("M2");
const M3 = mockMiddleware("M3");
const M4 = mockMiddleware("M4");
const M5 = mockMiddleware("M5");
const M6 = mockMiddleware("M6");

describe("MiddlewarePriorityBuilder", () => {
	let builder: MiddlewarePriorityBuilder;

	beforeEach(() => {
		builder = new MiddlewarePriorityBuilder([M1, M2, M3]);
	});

	describe("append", () => {
		test("adds middleware to end of list", () => {
			builder.append(M4);
			expect(builder.toArray()).toEqual([M1, M2, M3, M4]);
		});

		test("adds multiple middleware to end", () => {
			builder.append(M4, M5);
			expect(builder.toArray()).toEqual([M1, M2, M3, M4, M5]);
		});
	});

	describe("prepend", () => {
		test("adds middleware to start of list", () => {
			builder.prepend(M4);
			expect(builder.toArray()).toEqual([M4, M1, M2, M3]);
		});

		test("adds multiple middleware to start", () => {
			builder.prepend(M4, M5);
			expect(builder.toArray()).toEqual([M4, M5, M1, M2, M3]);
		});
	});

	describe("addBefore", () => {
		test("adds middleware before target", () => {
			builder.addBefore(M4, M2);
			expect(builder.toArray()).toEqual([M1, M4, M2, M3]);
		});

		test("throws if target not found", () => {
			const MX = mockMiddleware("MX");

			expect(() => builder.addBefore(M4, MX)).toThrow(
				"addBefore(M4, MX): MX not found in priority list",
			);
		});

		test("adds before first item", () => {
			builder.addBefore(M4, M1);
			expect(builder.toArray()).toEqual([M4, M1, M2, M3]);
		});
	});

	describe("addAfter", () => {
		test("adds middleware after target", () => {
			builder.addAfter(M4, M2);
			expect(builder.toArray()).toEqual([M1, M2, M4, M3]);
		});

		test("throws if target not found", () => {
			const MX = mockMiddleware("MX");

			expect(() => builder.addAfter(M4, MX)).toThrow(
				"addAfter(M4, MX): MX not found in priority list",
			);
		});

		test("adds after last item", () => {
			builder.addAfter(M4, M3);
			expect(builder.toArray()).toEqual([M1, M2, M3, M4]);
		});
	});

	describe("replaceAll", () => {
		test("replaces entire list", () => {
			builder.replaceAll([M4, M5]);
			expect(builder.toArray()).toEqual([M4, M5]);
		});

		test("clones the provided array", () => {
			const newList = [M4];
			builder.replaceAll(newList);
			newList.push(M5);
			expect(builder.toArray()).toEqual([M4]);
		});
	});

	describe("remove", () => {
		test("removes middleware from list", () => {
			builder.remove(M2);
			expect(builder.toArray()).toEqual([M1, M3]);
		});

		test("removes multiple middleware", () => {
			builder.remove(M1, M3);
			expect(builder.toArray()).toEqual([M2]);
		});

		test("does not throw if middleware not in list", () => {
			const MX = mockMiddleware("MX");
			expect(() => builder.remove(MX)).not.toThrow();
		});
	});

	describe("complex modifications", () => {
		test("supports multiple operations in sequence", () => {
			builder.prepend(M4).addAfter(M5, M3).remove(M2).addBefore(M6, M3);

			expect(builder.toArray()).toEqual([M4, M1, M6, M3, M5]);
		});

		test("replaceAll followed by modifications", () => {
			builder.replaceAll([M4, M5]).addBefore(M6, M5);

			expect(builder.toArray()).toEqual([M4, M6, M5]);
		});
	});

	describe("toArray", () => {
		test("returns a clone of the list", () => {
			const result = builder.toArray();
			result.push(M4);
			expect(builder.toArray()).toEqual([M1, M2, M3]);
		});
	});
});
