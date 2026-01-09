import { describe, expect, test } from "bun:test";
import { styleObjectToString } from "./style-attribute.ts";

describe("styleObjectToString", () => {
	test("converts camelCase to kebab-case", () => {
		expect(
			styleObjectToString({
				backgroundColor: "red",
				fontSize: "16px",
				borderTopWidth: "1px",
			}),
		).toBe("background-color:red;font-size:16px;border-top-width:1px");
	});

	test("adds px units to numeric values", () => {
		expect(
			styleObjectToString({
				width: 100,
				height: 50,
				fontSize: 14,
				marginTop: 20,
				padding: 10,
			}),
		).toBe("width:100px;height:50px;font-size:14px;margin-top:20px;padding:10px");
	});

	test("does not add px to unitless properties", () => {
		expect(
			styleObjectToString({
				opacity: 0.5,
				zIndex: 10,
				fontWeight: 700,
				lineHeight: 1.5,
				flexGrow: 2,
				flexShrink: 1,
				order: 3,
			}),
		).toBe(
			"opacity:0.5;z-index:10;font-weight:700;line-height:1.5;flex-grow:2;flex-shrink:1;order:3",
		);
	});

	test("preserves CSS variables", () => {
		expect(
			styleObjectToString({
				"--custom-color": "blue",
				"--spacing": 10,
				"--my-var": "value",
			}),
		).toBe("--custom-color:blue;--spacing:10px;--my-var:value");
	});

	test("skips null and undefined values", () => {
		expect(
			styleObjectToString({
				color: "red",
				width: null as unknown as undefined,
				height: undefined,
				fontSize: 14,
			}),
		).toBe("color:red;font-size:14px");
	});

	test("handles empty object", () => {
		expect(styleObjectToString({})).toBe("");
	});

	test("handles vendor prefixes", () => {
		expect(
			styleObjectToString({
				WebkitTransform: "scale(1.5)",
				MozTransform: "scale(1.5)",
				OTransform: "scale(1.5)",
				msTransform: "scale(1.5)",
			}),
		).toBe(
			"-webkit-transform:scale(1.5);-moz-transform:scale(1.5);-o-transform:scale(1.5);-ms-transform:scale(1.5)",
		);
	});

	test("handles vendor-prefixed unitless properties", () => {
		expect(
			styleObjectToString({
				WebkitFlex: "a",
				MozBoxFlex: "b",
				msFilter: "c",
				WebkitLineClamp: 4,
				WebkitBorderRadius: 5, // Not unitless - should get px
			}),
		).toBe(
			"-webkit-flex:a;-moz-box-flex:b;-ms-filter:c;-webkit-line-clamp:4;-webkit-border-radius:5px",
		);
	});

	test("handles zero values", () => {
		expect(
			styleObjectToString({
				margin: 0,
				padding: 0,
				opacity: 0,
			}),
		).toBe("margin:0px;padding:0px;opacity:0");
	});
});

describe("styleObjectToString type checking", () => {
	test("accepts valid style properties", () => {
		// This should compile without errors
		const validStyles = styleObjectToString({
			color: "red",
			fontSize: "16px",
			backgroundColor: "blue",
			margin: "10px",
			opacity: 0.5,
		});
		expect(validStyles).toBeTruthy();
	});

	test("catches misspelled properties with @ts-expect-error", () => {
		styleObjectToString({
			// @ts-expect-error: testing expected error
			foo: "red",
		});
	});

	test("catches incorrect value types with @ts-expect-error", () => {
		styleObjectToString({
			// @ts-expect-error: testing expected error
			textAlign: "invalid",
		});

		styleObjectToString({
			// @ts-expect-error: testing expected error
			color: 123, // color should be a string, not a number
		});
	});

	test("accepts vendor prefixed properties", () => {
		const vendorPrefixed = styleObjectToString({
			WebkitTransform: "scale(1.5)",
			MozTransform: "scale(1.5)",
			msTransform: "scale(1.5)",
		});
		expect(vendorPrefixed).toBeTruthy();
	});

	test("handles CSS custom properties", () => {
		const cssVariables = styleObjectToString({
			"--custom-color": "blue",
			"--spacing": "10px",
		});
		expect(cssVariables).toBe("--custom-color:blue;--spacing:10px");
	});
});
