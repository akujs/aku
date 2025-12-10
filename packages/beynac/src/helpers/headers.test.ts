import { describe, expect, test } from "bun:test";
import {
	contentDisposition,
	formatAttributeHeader,
	parseAttributeHeader,
} from "./headers/headers-entry-point.ts";

describe(contentDisposition, () => {
	describe("with filename - success cases", () => {
		test.each([
			// Basic filenames
			["basic", "plans.pdf", 'attachment; filename="plans.pdf"'],
			["with path", "/path/to/plans.pdf", 'attachment; filename="plans.pdf"'],

			// US-ASCII
			["US-ASCII with quotes", 'the "plans".pdf', 'attachment; filename="the \\"plans\\".pdf"'],

			// ISO-8859-1
			["ISO-8859-1", "«plans».pdf", 'attachment; filename="«plans».pdf"'],
			[
				"ISO-8859-1 with quotes",
				'the "plans" (1µ).pdf',
				'attachment; filename="the \\"plans\\" (1µ).pdf"',
			],

			// Unicode - now uses transliteration (€→E, планы→plany)
			[
				"Unicode Cyrillic",
				"планы.pdf",
				"attachment; filename=\"plany.pdf\"; filename*=UTF-8''%D0%BF%D0%BB%D0%B0%D0%BD%D1%8B.pdf",
			],
			[
				"Unicode mixed",
				"£ and € rates.pdf",
				"attachment; filename=\"£ and E rates.pdf\"; filename*=UTF-8''%C2%A3%20and%20%E2%82%AC%20rates.pdf",
			],
			[
				"Unicode euro",
				"€ rates.pdf",
				"attachment; filename=\"E rates.pdf\"; filename*=UTF-8''%E2%82%AC%20rates.pdf",
			],
			[
				"Unicode special chars",
				"€'*%().pdf",
				"attachment; filename=\"E'*%().pdf\"; filename*=UTF-8''%E2%82%AC%27%2A%25%28%29.pdf",
			],

			// Hex escapes
			[
				"hex escape",
				"the%20plans.pdf",
				"attachment; filename=\"the%20plans.pdf\"; filename*=UTF-8''the%2520plans.pdf",
			],
			[
				"hex escape with Unicode",
				"€%20£.pdf",
				"attachment; filename=\"E%20£.pdf\"; filename*=UTF-8''%E2%82%AC%2520%C2%A3.pdf",
			],
		])("%s: %s", (_, input, expected) => {
			expect(contentDisposition(input)).toBe(expected);
		});
	});

	describe("with filename - error cases", () => {
		test("should require a string", () => {
			expect(() => contentDisposition(42 as unknown as string)).toThrow(/filename.*string/);
		});
	});

	describe("with fallback option", () => {
		test("should require a string or Boolean", () => {
			expect(() => contentDisposition("plans.pdf", { fallback: 42 as unknown as string })).toThrow(
				/fallback.*string/,
			);
		});

		test("should default to true", () => {
			expect(contentDisposition("€ rates.pdf")).toBe(
				"attachment; filename=\"E rates.pdf\"; filename*=UTF-8''%E2%82%AC%20rates.pdf",
			);
		});

		test.each([
			[
				"fallback=false no fallback",
				"£ and € rates.pdf",
				false,
				"attachment; filename*=UTF-8''%C2%A3%20and%20%E2%82%AC%20rates.pdf",
			],
			[
				"fallback=false keeps ISO-8859-1",
				"£ rates.pdf",
				false,
				'attachment; filename="£ rates.pdf"',
			],
			[
				"fallback=true generates fallback",
				"£ and € rates.pdf",
				true,
				"attachment; filename=\"£ and E rates.pdf\"; filename*=UTF-8''%C2%A3%20and%20%E2%82%AC%20rates.pdf",
			],
			["fallback=true keeps ISO-8859-1", "£ rates.pdf", true, 'attachment; filename="£ rates.pdf"'],
		])("%s: %s", (_, input, fallback, expected) => {
			expect(contentDisposition(input, { fallback })).toBe(expected);
		});

		test("should require ISO-8859-1 string for fallback", () => {
			expect(() => contentDisposition("€ rates.pdf", { fallback: "€ rates.pdf" })).toThrow(
				/fallback.*iso-8859-1/i,
			);
		});

		test.each([
			[
				"custom fallback",
				"£ and € rates.pdf",
				"£ and EURO rates.pdf",
				"attachment; filename=\"£ and EURO rates.pdf\"; filename*=UTF-8''%C2%A3%20and%20%E2%82%AC%20rates.pdf",
			],
			[
				"fallback for ISO-8859-1",
				'"£ rates".pdf',
				"£ rates.pdf",
				"attachment; filename=\"£ rates.pdf\"; filename*=UTF-8''%22%C2%A3%20rates%22.pdf",
			],
			["fallback equal to filename", "plans.pdf", "plans.pdf", 'attachment; filename="plans.pdf"'],
			[
				"fallback basename",
				"€ rates.pdf",
				"/path/to/EURO rates.pdf",
				"attachment; filename=\"EURO rates.pdf\"; filename*=UTF-8''%E2%82%AC%20rates.pdf",
			],
		])("%s: %s", (_, input, fallback, expected) => {
			expect(contentDisposition(input, { fallback })).toBe(expected);
		});
	});
});

describe(formatAttributeHeader, () => {
	describe("api test cases", () => {
		test("basic attachment with ASCII filename", () => {
			expect(
				formatAttributeHeader({
					value: "attachment",
					attributes: { filename: "example.txt" },
				}),
			).toBe('attachment; filename="example.txt"');
		});

		test("attachment with unicode filename and custom fallback", () => {
			expect(
				formatAttributeHeader({
					value: "attachment",
					attributes: { filename: "❤️.txt" },
					fallbacks: { filename: "love.txt" },
				}),
			).toBe("attachment; filename=\"love.txt\"; filename*=UTF-8''%E2%9D%A4%EF%B8%8F.txt");
		});

		test("attachment with unicode filename and fallback disabled (false)", () => {
			expect(
				formatAttributeHeader({
					value: "attachment",
					attributes: { filename: "❤️.txt" },
					fallbacks: false,
				}),
			).toBe("attachment; filename*=UTF-8''%E2%9D%A4%EF%B8%8F.txt");
		});

		test("attachment with unicode filename and fallback disabled (object with false)", () => {
			expect(
				formatAttributeHeader({
					value: "attachment",
					attributes: { filename: "❤️.txt" },
					fallbacks: { filename: false },
				}),
			).toBe("attachment; filename*=UTF-8''%E2%9D%A4%EF%B8%8F.txt");
		});
	});
});

describe(parseAttributeHeader, () => {
	describe("error cases", () => {
		test("should require string", () => {
			expect(() => parseAttributeHeader(undefined as unknown as string)).toThrow(
				/argument string.*required/,
			);
		});

		test("should reject non-strings", () => {
			expect(() => parseAttributeHeader(42 as unknown as string)).toThrow(
				/argument string.*required/,
			);
		});

		test.each([
			// Invalid type format
			["quoted type", '"attachment"', /invalid type format/],
			["trailing semicolon (type only)", "attachment;", /invalid.*format/],
			["missing type with params", 'filename="plans.pdf"', /invalid type format/],
			["missing type with semicolon", '; filename="plans.pdf"', /invalid type format/],
			["no type, just params", "x=y; filename=foo.html", /invalid type format/],
			["quoted type with params", '"foo; filename=bar;baz"; filename=qux', /invalid type format/],
			["comma-separated", "filename=foo.html, filename=bar.html", /invalid type format/],
			["semicolon prefix", "; filename=foo.html", /invalid type format/],
			["colon prefix", ": inline; attachment; filename=foo.html", /invalid type format/],
			["type without semicolon separator", "attachment filename=bar", /invalid type format/],
			["params before type", "filename=foo.html; attachment", /invalid type format/],

			// Invalid parameter format
			[
				"trailing semicolon with params",
				'attachment; filename="rates.pdf";',
				/invalid parameter format/,
			],
			["invalid parameter name", 'attachment; filename@="rates.pdf"', /invalid parameter format/],
			["missing parameter value", "attachment; filename=", /invalid parameter format/],
			["comma in value", "attachment; filename=trolly,trains", /invalid parameter format/],
			[
				"slash in unquoted value",
				"attachment; filename=total/; foo=bar",
				/invalid parameter format/,
			],
			[
				"duplicate parameters",
				"attachment; filename=foo; filename=bar",
				/invalid duplicate parameter/,
			],
			["comma in filename", "attachment; filename=foo,bar.html", /invalid parameter format/],
			["space after unquoted value", "attachment; filename=foo.html ;", /invalid parameter format/],
			["consecutive semicolons", "attachment; ;filename=foo", /invalid parameter format/],
			["space in unquoted value", "attachment; filename=foo bar.html", /invalid parameter format/],
			[
				"brackets in unquoted value",
				"attachment; filename=foo[1](2).html",
				/invalid parameter format/,
			],
			["unicode in unquoted value", "attachment; filename=foo-ä.html", /invalid parameter format/],
			[
				"unicode bytes in unquoted value",
				"attachment; filename=foo-Ã¤.html",
				/invalid parameter format/,
			],
			["multiple types", "inline; attachment; filename=foo.html", /invalid parameter format/],
			[
				"reversed multiple types",
				"attachment; inline; filename=foo.html",
				/invalid parameter format/,
			],
			[
				"text after quoted value",
				'attachment; filename="foo.html".txt',
				/invalid parameter format/,
			],
			["unclosed quote", 'attachment; filename="bar', /invalid parameter format/],
			[
				"quotes in unquoted value",
				'attachment; filename=foo"bar;baz"qux',
				/invalid parameter format/,
			],
			[
				"comma-separated headers",
				"attachment; filename=foo.html, attachment; filename=bar.html",
				/invalid parameter format/,
			],
			[
				"missing semicolon between params",
				"attachment; foo=foo filename=bar",
				/invalid parameter format/,
			],
			[
				"reversed params without semicolon",
				"attachment; filename=bar foo=foo",
				/invalid parameter format/,
			],

			// Extended parameter errors
			[
				"quoted extended parameter",
				"attachment; filename*=\"UTF-8''%E2%82%AC%20rates.pdf\"",
				/invalid extended.*value/,
			],
			[
				"unsupported charset",
				"attachment; filename*=ISO-8859-2''%A4%20rates.pdf",
				/unsupported charset/,
			],
			[
				"missing charset",
				"attachment; filename*=''foo-%c3%a4-%e2%82%ac.html",
				/invalid extended.*value/,
			],
			[
				"space before asterisk",
				"attachment; filename *=UTF-8''foo-%c3%a4.html",
				/invalid parameter format/,
			],
			[
				"quoted extended value",
				"attachment; filename*=\"UTF-8''foo-%c3%a4.html\"",
				/invalid extended field value/,
			],
			[
				"quoted percent encoding",
				'attachment; filename*="foo%20bar.html"',
				/invalid extended field value/,
			],
			[
				"single quote in extended",
				"attachment; filename*=UTF-8'foo-%c3%a4.html",
				/invalid extended field value/,
			],
			["incomplete percent", "attachment; filename*=UTF-8''foo%", /invalid extended field value/],
			[
				"invalid percent position",
				"attachment; filename*=UTF-8''f%oo.html",
				/invalid extended field value/,
			],
			[
				"RFC2047 without quotes",
				"attachment; filename==?ISO-8859-1?Q?foo-=E4.html?=",
				/invalid parameter format/,
			],
		])("%s", (_, input, error) => {
			expect(() => parseAttributeHeader(input)).toThrow(error);
		});
	});

	describe("success cases", () => {
		test.each([
			// Type only
			["attachment", "attachment", { value: "attachment", attributes: {} }],
			["inline", "inline", { value: "inline", attributes: {} }],
			["form-data", "form-data", { value: "form-data", attributes: {} }],
			["trailing whitespace", "attachment \t ", { value: "attachment", attributes: {} }],
			["uppercase normalized", "ATTACHMENT", { value: "attachment", attributes: {} }],
			["foobar type", "foobar", { value: "foobar", attributes: {} }],

			// Basic parameters
			[
				"quoted filename",
				'attachment; filename="plans.pdf"',
				{ value: "attachment", attributes: { filename: "plans.pdf" } },
			],
			[
				"lowercase param name",
				'attachment; FILENAME="plans.pdf"',
				{ value: "attachment", attributes: { filename: "plans.pdf" } },
			],
			[
				"unescaped quotes",
				'attachment; filename="the \\"plans\\".pdf"',
				{ value: "attachment", attributes: { filename: 'the "plans".pdf' } },
			],
			[
				"multiple parameters",
				'attachment; filename="plans.pdf"; foo=bar',
				{ value: "attachment", attributes: { filename: "plans.pdf", foo: "bar" } },
			],
			[
				"whitespace around params",
				'attachment;filename="plans.pdf" \t;    \t\t foo=bar',
				{ value: "attachment", attributes: { filename: "plans.pdf", foo: "bar" } },
			],
			[
				"token filename",
				"attachment; filename=plans.pdf",
				{ value: "attachment", attributes: { filename: "plans.pdf" } },
			],
			[
				"ISO-8859-1 filename",
				'attachment; filename="£ rates.pdf"',
				{ value: "attachment", attributes: { filename: "£ rates.pdf" } },
			],
			[
				"long filename 1",
				'attachment; filename="0000000000111111111122222"',
				{ value: "attachment", attributes: { filename: "0000000000111111111122222" } },
			],
			[
				"long filename 2",
				'attachment; filename="00000000001111111111222222222233333"',
				{ value: "attachment", attributes: { filename: "00000000001111111111222222222233333" } },
			],
			[
				"backslash escape",
				'attachment; filename="f\\oo.html"',
				{ value: "attachment", attributes: { filename: "foo.html" } },
			],
			[
				"escaped quotes in value",
				'attachment; filename="\\"quoting\\" tested.html"',
				{ value: "attachment", attributes: { filename: '"quoting" tested.html' } },
			],
			[
				"semicolon in quoted value",
				'attachment; filename="Here\'s a semicolon;.html"',
				{ value: "attachment", attributes: { filename: "Here's a semicolon;.html" } },
			],
			[
				"multiple params order 1",
				'attachment; foo="bar"; filename="foo.html"',
				{ value: "attachment", attributes: { filename: "foo.html", foo: "bar" } },
			],
			[
				"multiple params with escapes",
				'attachment; foo="\\"\\\\";filename="foo.html"',
				{ value: "attachment", attributes: { filename: "foo.html", foo: '"\\' } },
			],
			[
				"single quotes in token",
				"attachment; filename='foo.bar'",
				{ value: "attachment", attributes: { filename: "'foo.bar'" } },
			],
			[
				"unicode in quoted",
				'attachment; filename="foo-ä.html"',
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"utf8 bytes in quoted",
				'attachment; filename="foo-Ã¤.html"',
				{ value: "attachment", attributes: { filename: "foo-Ã¤.html" } },
			],
			[
				"percent in quoted",
				'attachment; filename="foo-%41.html"',
				{ value: "attachment", attributes: { filename: "foo-%41.html" } },
			],
			[
				"50 percent",
				'attachment; filename="50%.html"',
				{ value: "attachment", attributes: { filename: "50%.html" } },
			],
			[
				"escaped percent",
				'attachment; filename="foo-%\\41.html"',
				{ value: "attachment", attributes: { filename: "foo-%41.html" } },
			],
			[
				"name parameter",
				'attachment; name="foo-%41.html"',
				{ value: "attachment", attributes: { name: "foo-%41.html" } },
			],
			[
				"unicode and percent",
				'attachment; filename="ä-%41.html"',
				{ value: "attachment", attributes: { filename: "ä-%41.html" } },
			],
			[
				"multiple percent escapes",
				'attachment; filename="foo-%c3%a4-%e2%82%ac.html"',
				{ value: "attachment", attributes: { filename: "foo-%c3%a4-%e2%82%ac.html" } },
			],
			[
				"space before equals",
				'attachment; filename ="foo.html"',
				{ value: "attachment", attributes: { filename: "foo.html" } },
			],
			[
				"xfilename",
				"attachment; xfilename=foo.html",
				{ value: "attachment", attributes: { xfilename: "foo.html" } },
			],
			[
				"slash in quoted",
				'attachment; filename="/foo.html"',
				{ value: "attachment", attributes: { filename: "/foo.html" } },
			],
			[
				"backslash in quoted",
				'attachment; filename="\\\\foo.html"',
				{ value: "attachment", attributes: { filename: "\\foo.html" } },
			],

			// Extended parameters UTF-8
			[
				"extended UTF-8",
				"attachment; filename*=UTF-8''%E2%82%AC%20rates.pdf",
				{ value: "attachment", attributes: { filename: "€ rates.pdf" } },
			],
			[
				"extended utf8 lowercase",
				"attachment; filename*=utf8''%E2%82%AC%20rates.pdf",
				{ value: "attachment", attributes: { filename: "€ rates.pdf" } },
			],
			[
				"extended invalid utf8",
				"attachment; filename*=UTF-8''%E4%20rates.pdf",
				{ value: "attachment", attributes: { filename: "\ufffd rates.pdf" } },
			],
			[
				"extended utf-8 hyphen",
				"attachment; filename*=utf-8''%E2%82%AC%20rates.pdf",
				{ value: "attachment", attributes: { filename: "€ rates.pdf" } },
			],
			[
				"extended with language",
				"attachment; filename*=UTF-8'en'%E2%82%AC%20rates.pdf",
				{ value: "attachment", attributes: { filename: "€ rates.pdf" } },
			],
			[
				"extended combining chars",
				"attachment; filename*=UTF-8''foo-a%cc%88.html",
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"extended double encoded",
				"attachment; filename*=UTF-8''A-%2541.html",
				{ value: "attachment", attributes: { filename: "A-%41.html" } },
			],
			[
				"extended backslash",
				"attachment; filename*=UTF-8''%5cfoo.html",
				{ value: "attachment", attributes: { filename: "\\foo.html" } },
			],
			[
				"extended space after equals",
				"attachment; filename*= UTF-8''foo-%c3%a4.html",
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"extended space after param",
				"attachment; filename* =UTF-8''foo-%c3%a4.html",
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"extended full UTF-8",
				"attachment; filename*=UTF-8''foo-%c3%a4-%e2%82%ac.html",
				{ value: "attachment", attributes: { filename: "foo-ä-€.html" } },
			],
			[
				"extended invalid single byte",
				"attachment; filename*=utf-8''foo-%E4.html",
				{ value: "attachment", attributes: { filename: "foo-\ufffd.html" } },
			],

			// Extended parameters ISO-8859-1
			[
				"extended ISO-8859-1",
				"attachment; filename*=ISO-8859-1''%A3%20rates.pdf",
				{ value: "attachment", attributes: { filename: "£ rates.pdf" } },
			],
			[
				"extended ISO-8859-1 invalid",
				"attachment; filename*=ISO-8859-1''%82%20rates.pdf",
				{ value: "attachment", attributes: { filename: "? rates.pdf" } },
			],
			[
				"extended iso-8859-1 lowercase",
				"attachment; filename*=iso-8859-1''foo-%E4.html",
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"extended ISO-8859-1 utf8 bytes",
				"attachment; filename*=iso-8859-1''foo-%c3%a4-%e2%82%ac.html",
				{ value: "attachment", attributes: { filename: "foo-Ã¤-â?¬.html" } },
			],

			// Preference and fallback
			[
				"prefer extended over regular 1",
				"attachment; filename=\"EURO rates.pdf\"; filename*=UTF-8''%E2%82%AC%20rates.pdf",
				{ value: "attachment", attributes: { filename: "€ rates.pdf" } },
			],
			[
				"prefer extended over regular 2",
				"attachment; filename*=UTF-8''%E2%82%AC%20rates.pdf; filename=\"EURO rates.pdf\"",
				{ value: "attachment", attributes: { filename: "€ rates.pdf" } },
			],
			[
				"extended with fallback",
				"attachment; filename=\"foo-ae.html\"; filename*=UTF-8''foo-%c3%a4.html",
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"reversed extended with fallback",
				"attachment; filename*=UTF-8''foo-%c3%a4.html; filename=\"foo-ae.html\"",
				{ value: "attachment", attributes: { filename: "foo-ä.html" } },
			],
			[
				"mixed params",
				'attachment; foobar=x; filename="foo.html"',
				{ value: "attachment", attributes: { filename: "foo.html", foobar: "x" } },
			],

			// Continuations (not merged, kept as separate params)
			[
				"continuation 0 and 1",
				'attachment; filename*0="foo."; filename*1="html"',
				{ value: "attachment", attributes: { "filename*0": "foo.", "filename*1": "html" } },
			],
			[
				"continuation with escapes",
				'attachment; filename*0="foo"; filename*1="\\b\\a\\r.html"',
				{ value: "attachment", attributes: { "filename*0": "foo", "filename*1": "bar.html" } },
			],
			[
				"continuation extended first",
				"attachment; filename*0*=UTF-8''foo-%c3%a4; filename*1=\".html\"",
				{
					value: "attachment",
					attributes: { "filename*0*": "UTF-8''foo-%c3%a4", "filename*1": ".html" },
				},
			],
			[
				"continuation 0 and 01",
				'attachment; filename*0="foo"; filename*01="bar"',
				{ value: "attachment", attributes: { "filename*0": "foo", "filename*01": "bar" } },
			],
			[
				"continuation 0 and 2",
				'attachment; filename*0="foo"; filename*2="bar"',
				{ value: "attachment", attributes: { "filename*0": "foo", "filename*2": "bar" } },
			],
			[
				"continuation 1 and 2",
				'attachment; filename*1="foo."; filename*2="html"',
				{ value: "attachment", attributes: { "filename*1": "foo.", "filename*2": "html" } },
			],
			[
				"continuation reversed",
				'attachment; filename*1="bar"; filename*0="foo"',
				{ value: "attachment", attributes: { "filename*1": "bar", "filename*0": "foo" } },
			],
			[
				"continuation with extended fallback",
				"attachment; filename*0*=ISO-8859-15''euro-sign%3d%a4; filename*=ISO-8859-1''currency-sign%3d%a4",
				{
					value: "attachment",
					attributes: {
						filename: "currency-sign=¤",
						"filename*0*": "ISO-8859-15''euro-sign%3d%a4",
					},
				},
			],

			// Additional parameters
			[
				"creation-date",
				'attachment; creation-date="Wed, 12 Feb 1997 16:29:51 -0500"',
				{ value: "attachment", attributes: { "creation-date": "Wed, 12 Feb 1997 16:29:51 -0500" } },
			],
			[
				"modification-date",
				'attachment; modification-date="Wed, 12 Feb 1997 16:29:51 -0500"',
				{
					value: "attachment",
					attributes: { "modification-date": "Wed, 12 Feb 1997 16:29:51 -0500" },
				},
			],

			// Special cases
			[
				"inline with filename",
				'inline; filename="foo.html"',
				{ value: "inline", attributes: { filename: "foo.html" } },
			],
			[
				"inline exclamation",
				'inline; filename="Not an attachment!"',
				{ value: "inline", attributes: { filename: "Not an attachment!" } },
			],
			[
				"inline pdf",
				'inline; filename="foo.pdf"',
				{ value: "inline", attributes: { filename: "foo.pdf" } },
			],
			[
				"custom example param",
				'attachment; example="filename=example.txt"',
				{ value: "attachment", attributes: { example: "filename=example.txt" } },
			],
			[
				"RFC2047 in quotes",
				'attachment; filename="=?ISO-8859-1?Q?foo-=E4.html?="',
				{ value: "attachment", attributes: { filename: "=?ISO-8859-1?Q?foo-=E4.html?=" } },
			],
		])("%s: %s", (_, input, expected) => {
			expect(parseAttributeHeader(input)).toMatchObject(expected);
		});
	});
});
