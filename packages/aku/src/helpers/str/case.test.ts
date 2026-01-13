import { describe, expect, spyOn, test } from "bun:test";
import {
	camelCase,
	kebabCase,
	lowercase,
	lowercaseFirst,
	pascalCase,
	sentenceCase,
	snakeCase,
	splitWords,
	studlyCase,
	titleCase,
	uppercase,
	uppercaseFirst,
} from "./case.ts";

describe(titleCase, () => {
	test("converts basic strings", () => {
		expect(titleCase("hello world")).toBe("Hello World");
		expect(titleCase("hello_world")).toBe("Hello World");
		expect(titleCase("hello-world")).toBe("Hello World");
		expect(titleCase("helloWorld")).toBe("Hello World");
		expect(titleCase("HelloWorld")).toBe("Hello World");
	});

	test("handles minor words with default list", () => {
		expect(titleCase("the quick brown fox")).toBe("The Quick Brown Fox");
		expect(titleCase("a tale of two cities")).toBe("A Tale of Two Cities");
		expect(titleCase("the cat and the dog")).toBe("The Cat and the Dog");
		expect(titleCase("end of the line")).toBe("End of the Line");
		expect(titleCase("the beginning")).toBe("The Beginning");
		expect(titleCase("step by step guide")).toBe("Step by Step Guide");
	});

	test("capitalises first and last words even if minor", () => {
		expect(titleCase("the end")).toBe("The End");
		expect(titleCase("of mice and men")).toBe("Of Mice and Men");
		expect(titleCase("a")).toBe("A");
		expect(titleCase("this in. the end")).toBe("This In. The End");
		expect(titleCase("this in. of mice and men")).toBe("This In. Of Mice and Men");
		expect(titleCase("this in. a")).toBe("This In. A");
		expect(titleCase("this in rather. a")).toBe("This in Rather. A");
	});

	test("handles minorWords: false", () => {
		expect(titleCase("the cat and the dog", { minorWords: false })).toBe("The Cat And The Dog");
		expect(titleCase("a tale of two cities", { minorWords: false })).toBe("A Tale Of Two Cities");
	});

	test("handles minorWords: []", () => {
		expect(titleCase("the cat and the dog", { minorWords: [] })).toBe("The Cat And The Dog");
	});

	test("handles minorWords: true", () => {
		expect(titleCase("the cat and the dog", { minorWords: true })).toBe("The Cat and the Dog");
	});

	test("handles custom minorWords list", () => {
		expect(titleCase("x marks the spot", { minorWords: ["x", "y"] })).toBe("X Marks The Spot");
		expect(titleCase("the x and y axis", { minorWords: ["x", "y"] })).toBe("The x And y Axis");
	});

	test("capitalises minor words after sentence-ending punctuation", () => {
		expect(titleCase("end of story. the beginning")).toBe("End of Story. The Beginning");
		expect(titleCase("first! and second? or third.")).toBe("First! And Second? Or Third.");
		expect(titleCase("title. the subtitle")).toBe("Title. The Subtitle");
	});

	test("space-containing inputs preserve hyphens as-is", () => {
		expect(titleCase("foo bar-baz")).toBe("Foo Bar-Baz");
		expect(titleCase("foo bar-in-baz")).toBe("Foo Bar-in-Baz");
		expect(titleCase("twenty-one pilots")).toBe("Twenty-One Pilots");
		expect(titleCase("state-of-the-art design")).toBe("State-of-the-Art Design");
	});

	test("inputs without spaces treat hyphens as separators", () => {
		expect(titleCase("foo-bar-baz")).toBe("Foo Bar Baz");
		expect(titleCase("foo-bar-in-baz")).toBe("Foo Bar in Baz");
		expect(titleCase("test-case-result")).toBe("Test Case Result");
	});

	test("preserves acronyms in mixed case input", () => {
		expect(titleCase("myXMLParser")).toBe("My XML Parser");
		expect(titleCase("handleHTTPSConnection")).toBe("Handle HTTPS Connection");
		expect(titleCase("parseXMLFromAPI")).toBe("Parse XML from API");
		expect(titleCase("project LoL is awesome")).toBe("Project LoL Is Awesome");
	});

	test("applies title case to all lowercase input", () => {
		expect(titleCase("my_xml_parser")).toBe("My Xml Parser");
		expect(titleCase("https_connection")).toBe("Https Connection");
	});

	test("handles numbers as word boundaries", () => {
		expect(titleCase("hello2World")).toBe("Hello 2 World");
		expect(titleCase("test123abc")).toBe("Test 123 Abc");
		expect(titleCase("version2Update3")).toBe("Version 2 Update 3");
	});

	test("handles consecutive capitals", () => {
		expect(titleCase("XMLParser")).toBe("XML Parser");
		expect(titleCase("HTTPSConnection")).toBe("HTTPS Connection");
	});

	test("handles empty and edge cases", () => {
		expect(titleCase("")).toBe("");
		expect(titleCase("a")).toBe("A");
		expect(titleCase("hello")).toBe("Hello");
	});

	test("trims and normalises whitespace", () => {
		expect(titleCase("  hello world  ")).toBe("Hello World");
		expect(titleCase("hello   world")).toBe("Hello World");
		expect(titleCase("  hello_world  ")).toBe("Hello World");
	});

	test("strips leading and trailing separators", () => {
		expect(titleCase("_hello_world_")).toBe("Hello World");
		expect(titleCase("-hello-world-")).toBe("Hello World");
	});

	test("collapses multiple consecutive separators", () => {
		expect(titleCase("hello___world")).toBe("Hello World");
		expect(titleCase("hello---world")).toBe("Hello World");
	});

	test("handles mixed consecutive separators", () => {
		expect(titleCase("hello__--__world")).toBe("Hello World");
	});

	test("all examples from doc comment work correctly", () => {
		expect(titleCase("hello world")).toBe("Hello World");
		expect(titleCase("a tale of two cities")).toBe("A Tale of Two Cities");
		expect(titleCase("the cat and the dog")).toBe("The Cat and the Dog");
		expect(titleCase("foo bar-baz")).toBe("Foo Bar-Baz");
		expect(titleCase("foo-bar-baz")).toBe("Foo Bar Baz");
		expect(titleCase("game on", { minorWords: false })).toBe("Game On");
	});
});

describe(snakeCase, () => {
	test("converts basic strings to lower snake_case", () => {
		expect(snakeCase("helloWorld")).toBe("hello_world");
		expect(snakeCase("HelloWorld")).toBe("hello_world");
		expect(snakeCase("hello world")).toBe("hello_world");
		expect(snakeCase("hello-world")).toBe("hello_world");
		expect(snakeCase("hello_world")).toBe("hello_world");
	});

	test("handles case: 'upper' for SHOUTY_SNAKE_CASE", () => {
		expect(snakeCase("helloWorld", { case: "upper" })).toBe("HELLO_WORLD");
		expect(snakeCase("hello world", { case: "upper" })).toBe("HELLO_WORLD");
		expect(snakeCase("XMLParser", { case: "upper" })).toBe("XML_PARSER");
	});

	test("handles case: 'preserve' to keep original casing", () => {
		expect(snakeCase("helloWorld", { case: "preserve" })).toBe("hello_World");
		expect(snakeCase("XMLParser", { case: "preserve" })).toBe("XML_Parser");
		expect(snakeCase("myXMLParser", { case: "preserve" })).toBe("my_XML_Parser");
		expect(snakeCase("hello World", { case: "preserve" })).toBe("hello_World");
		expect(snakeCase("HTTPSConnection", { case: "preserve" })).toBe("HTTPS_Connection");
	});

	test("normalises multiple consecutive separators", () => {
		expect(snakeCase("foo___bar")).toBe("foo_bar");
		expect(snakeCase("hello---world")).toBe("hello_world");
		expect(snakeCase("test  world")).toBe("test_world");
	});

	test("handles consecutive capitals", () => {
		expect(snakeCase("XMLParser")).toBe("xml_parser");
		expect(snakeCase("myXMLParser")).toBe("my_xml_parser");
	});

	test("strips leading and trailing separators", () => {
		expect(snakeCase("_hello_world_")).toBe("hello_world");
		expect(snakeCase("-test-")).toBe("test");
	});

	test("handles empty and edge cases", () => {
		expect(snakeCase("")).toBe("");
		expect(snakeCase("hello")).toBe("hello");
	});

	test("trims and normalises whitespace", () => {
		expect(snakeCase("  hello world  ")).toBe("hello_world");
		expect(snakeCase("hello   world")).toBe("hello_world");
	});

	test("handles punctuation", () => {
		expect(snakeCase("Sentence with, some punctuation!")).toBe("sentence_with_some_punctuation");
	});

	test("all examples from doc comment work correctly", () => {
		expect(snakeCase("helloWorld")).toBe("hello_world");
		expect(snakeCase("Hello World")).toBe("hello_world");
		expect(snakeCase("shoutySnakeCase", { case: "upper" })).toBe("SHOUTY_SNAKE_CASE");
		expect(snakeCase("helloWorld", { case: "preserve" })).toBe("hello_World");
	});
});

describe(pascalCase, () => {
	test("converts basic strings", () => {
		expect(pascalCase("hello world")).toBe("HelloWorld");
		expect(pascalCase("hello_world")).toBe("HelloWorld");
		expect(pascalCase("hello-world")).toBe("HelloWorld");
		expect(pascalCase("helloWorld")).toBe("HelloWorld");
		expect(pascalCase("hello World")).toBe("HelloWorld");
	});

	test("preserves acronyms in mixed case input", () => {
		expect(pascalCase("XMLParser")).toBe("XMLParser");
		expect(pascalCase("myXMLParser")).toBe("MyXMLParser");
	});

	test("converts all lowercase acronyms", () => {
		expect(pascalCase("xml_parser")).toBe("XmlParser");
	});

	test("handles numbers as word boundaries", () => {
		expect(pascalCase("hello2World")).toBe("Hello2World");
		expect(pascalCase("test_123_abc")).toBe("Test123Abc");
	});

	test("handles empty and edge cases", () => {
		expect(pascalCase("")).toBe("");
		expect(pascalCase("hello")).toBe("Hello");
		expect(pascalCase("a")).toBe("A");
	});

	test("strips leading and trailing separators", () => {
		expect(pascalCase("_hello_world_")).toBe("HelloWorld");
	});

	test("normalises multiple consecutive separators", () => {
		expect(pascalCase("foo___bar")).toBe("FooBar");
	});

	test("handles punctuation", () => {
		expect(pascalCase("Sentence with, some punctuation!")).toBe("SentenceWithSomePunctuation");
	});

	test("all examples from doc comment work correctly", () => {
		expect(pascalCase("hello world")).toBe("HelloWorld");
		expect(pascalCase("hello_world")).toBe("HelloWorld");
		expect(pascalCase("hello-world")).toBe("HelloWorld");
		expect(pascalCase("Sentence with, some punctuation!")).toBe("SentenceWithSomePunctuation");
	});
});

describe(camelCase, () => {
	test("converts basic strings", () => {
		expect(camelCase("hello world")).toBe("helloWorld");
		expect(camelCase("hello_world")).toBe("helloWorld");
		expect(camelCase("HelloWorld")).toBe("helloWorld");
		expect(camelCase("hello-world")).toBe("helloWorld");
	});

	test("preserves acronyms in mixed case input (except first word)", () => {
		expect(camelCase("XMLParser")).toBe("xmlParser");
		expect(camelCase("myXMLParser")).toBe("myXMLParser");
	});

	test("handles numbers as word boundaries", () => {
		expect(camelCase("hello2World")).toBe("hello2World");
		expect(camelCase("test_123_abc")).toBe("test123Abc");
	});

	test("handles empty and edge cases", () => {
		expect(camelCase("")).toBe("");
		expect(camelCase("hello")).toBe("hello");
		expect(camelCase("Hello")).toBe("hello");
	});

	test("strips leading and trailing separators", () => {
		expect(camelCase("_hello_world_")).toBe("helloWorld");
	});

	test("normalises multiple consecutive separators", () => {
		expect(camelCase("foo___bar")).toBe("fooBar");
	});

	test("handles punctuation", () => {
		expect(camelCase("Sentence with, some punctuation!")).toBe("sentenceWithSomePunctuation");
	});

	test("all examples from doc comment work correctly", () => {
		expect(camelCase("hello world")).toBe("helloWorld");
		expect(camelCase("hello_world")).toBe("helloWorld");
		expect(camelCase("HelloWorld")).toBe("helloWorld");
		expect(camelCase("Sentence with, some punctuation!")).toBe("sentenceWithSomePunctuation");
	});
});

describe(kebabCase, () => {
	test("converts basic strings", () => {
		expect(kebabCase("helloWorld")).toBe("hello-world");
		expect(kebabCase("HelloWorld")).toBe("hello-world");
		expect(kebabCase("hello world")).toBe("hello-world");
		expect(kebabCase("hello_world")).toBe("hello-world");
		expect(kebabCase("hello-world")).toBe("hello-world");
	});

	test("handles acronyms", () => {
		expect(kebabCase("XMLParser")).toBe("xml-parser");
		expect(kebabCase("myXMLParser")).toBe("my-xml-parser");
	});

	test("handles numbers as word boundaries", () => {
		expect(kebabCase("hello2World")).toBe("hello-2-world");
		expect(kebabCase("test123abc")).toBe("test-123-abc");
	});

	test("strips leading and trailing separators", () => {
		expect(kebabCase("_hello_world_")).toBe("hello-world");
	});

	test("normalises multiple consecutive separators", () => {
		expect(kebabCase("foo___bar")).toBe("foo-bar");
		expect(kebabCase("hello   world")).toBe("hello-world");
	});

	test("handles empty and edge cases", () => {
		expect(kebabCase("")).toBe("");
		expect(kebabCase("hello")).toBe("hello");
	});

	test("all examples from doc comment work correctly", () => {
		expect(kebabCase("helloWorld")).toBe("hello-world");
		expect(kebabCase("HelloWorld")).toBe("hello-world");
		expect(kebabCase("hello world")).toBe("hello-world");
	});
});

describe(sentenceCase, () => {
	test("converts basic strings", () => {
		expect(sentenceCase("hello world")).toBe("Hello world");
		expect(sentenceCase("helloWorld")).toBe("Hello world");
		expect(sentenceCase("hello_world")).toBe("Hello world");
		expect(sentenceCase("HELLO WORLD")).toBe("HELLO WORLD");
	});

	test("capitalises first word after sentence ending punctuation", () => {
		expect(sentenceCase("hello world. another sentence")).toBe("Hello world. Another sentence");
		expect(sentenceCase("first! second? third.")).toBe("First! Second? Third.");
		expect(sentenceCase("hello.world")).toBe("Hello. World");
		expect(sentenceCase("hello. world")).toBe("Hello. World");
	});

	test("handles custom sentenceEndChars", () => {
		expect(sentenceCase("title: the subtitle", { sentenceEndChars: [".", "!", "?", ":"] })).toBe(
			"Title: The subtitle",
		);
		expect(sentenceCase("first: second: third", { sentenceEndChars: [":", ".", "!", "?"] })).toBe(
			"First: Second: Third",
		);
	});

	test("handles empty sentenceEndChars", () => {
		expect(sentenceCase("hello. world! test?", { sentenceEndChars: [] })).toBe(
			"Hello. world! test?",
		);
	});

	test("space-containing inputs preserve hyphens as-is", () => {
		expect(sentenceCase("foo bar-baz. next sentence")).toBe("Foo bar-baz. Next sentence");
		expect(sentenceCase("state-of-the-art design")).toBe("State-of-the-art design");
	});

	test("inputs without spaces treat hyphens as separators", () => {
		expect(sentenceCase("foo-bar-baz")).toBe("Foo bar baz");
	});

	test("preserves acronyms in mixed case input", () => {
		expect(sentenceCase("myXMLParser")).toBe("My XML parser");
		expect(sentenceCase("project X is awesome")).toBe("Project X is awesome");
	});

	test("applies sentence case to all uppercase input", () => {
		expect(sentenceCase("MY_XML_PARSER")).toBe("MY XML PARSER");
	});

	test("handles numbers as word boundaries", () => {
		expect(sentenceCase("hello2World")).toBe("Hello 2 world");
		expect(sentenceCase("test123abc")).toBe("Test 123 abc");
	});

	test("handles empty and edge cases", () => {
		expect(sentenceCase("")).toBe("");
		expect(sentenceCase("hello")).toBe("Hello");
	});

	test("strips leading and trailing separators", () => {
		expect(sentenceCase("_hello_world_")).toBe("Hello world");
	});

	test("normalises multiple consecutive separators", () => {
		expect(sentenceCase("hello___world")).toBe("Hello world");
	});

	test("all examples from doc comment work correctly", () => {
		expect(sentenceCase("hello world")).toBe("Hello world");
		expect(sentenceCase("hello world. another sentence")).toBe("Hello world. Another sentence");
		expect(sentenceCase("first! second? third.")).toBe("First! Second? Third.");
	});
});

describe(studlyCase, () => {
	test("randomizes case of each character", () => {
		const randomSpy = spyOn(Math, "random");
		randomSpy
			.mockReturnValueOnce(0.6) // > 0.5: uppercase 'h' → 'H'
			.mockReturnValueOnce(0.3) // ≤ 0.5: lowercase 'e' → 'e'
			.mockReturnValueOnce(0.7) // > 0.5: uppercase 'l' → 'L'
			.mockReturnValueOnce(0.4) // ≤ 0.5: lowercase 'l' → 'l'
			.mockReturnValueOnce(0.8) // > 0.5: uppercase 'o' → 'O'
			.mockReturnValueOnce(0.2) // ≤ 0.5: lowercase ' ' → ' '
			.mockReturnValueOnce(0.9) // > 0.5: uppercase 'w' → 'W'
			.mockReturnValueOnce(0.1) // ≤ 0.5: lowercase 'o' → 'o'
			.mockReturnValueOnce(0.6) // > 0.5: uppercase 'r' → 'R'
			.mockReturnValueOnce(0.5) // ≤ 0.5: lowercase 'l' → 'l'
			.mockReturnValueOnce(0.8); // > 0.5: uppercase 'd' → 'D'

		expect(studlyCase("hello world")).toBe("HeLlO WoRlD");
		randomSpy.mockRestore();
	});

	test("all examples from doc comment work correctly", () => {
		const randomSpy = spyOn(Math, "random");
		// For "hello world" example
		randomSpy
			.mockReturnValueOnce(0.6)
			.mockReturnValueOnce(0.3)
			.mockReturnValueOnce(0.7)
			.mockReturnValueOnce(0.4)
			.mockReturnValueOnce(0.8)
			.mockReturnValueOnce(0.2)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.1)
			.mockReturnValueOnce(0.6)
			.mockReturnValueOnce(0.5)
			.mockReturnValueOnce(0.8);
		expect(studlyCase("hello world")).toBe("HeLlO WoRlD");

		// For "hello_world" example
		randomSpy
			.mockReturnValueOnce(0.6)
			.mockReturnValueOnce(0.3)
			.mockReturnValueOnce(0.7)
			.mockReturnValueOnce(0.4)
			.mockReturnValueOnce(0.8)
			.mockReturnValueOnce(0.2)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.1)
			.mockReturnValueOnce(0.6)
			.mockReturnValueOnce(0.5)
			.mockReturnValueOnce(0.8);
		expect(studlyCase("hello_world")).toBe("HeLlO_WoRlD");

		randomSpy.mockRestore();
	});
});

describe(uppercaseFirst, () => {
	test("capitalises first character only", () => {
		expect(uppercaseFirst("hello world")).toBe("Hello world");
		expect(uppercaseFirst("hello_world")).toBe("Hello_world");
		expect(uppercaseFirst("helloWorld")).toBe("HelloWorld");
	});

	test("handles already capitalized strings", () => {
		expect(uppercaseFirst("Hello world")).toBe("Hello world");
	});

	test("handles empty and edge cases", () => {
		expect(uppercaseFirst("")).toBe("");
		expect(uppercaseFirst("a")).toBe("A");
	});

	test("handles strings starting with non-letters", () => {
		expect(uppercaseFirst("123hello")).toBe("123hello");
		expect(uppercaseFirst("_hello")).toBe("_hello");
	});

	test("all examples from doc comment work correctly", () => {
		expect(uppercaseFirst("hello world")).toBe("Hello world");
		expect(uppercaseFirst("hello_world")).toBe("Hello_world");
	});
});

describe(lowercaseFirst, () => {
	test("lowercases first character only", () => {
		expect(lowercaseFirst("Hello World")).toBe("hello World");
		expect(lowercaseFirst("Hello_World")).toBe("hello_World");
		expect(lowercaseFirst("HelloWorld")).toBe("helloWorld");
	});

	test("handles already lowercase strings", () => {
		expect(lowercaseFirst("hello world")).toBe("hello world");
	});

	test("handles empty and edge cases", () => {
		expect(lowercaseFirst("")).toBe("");
		expect(lowercaseFirst("A")).toBe("a");
	});

	test("handles strings starting with non-letters", () => {
		expect(lowercaseFirst("123Hello")).toBe("123Hello");
		expect(lowercaseFirst("_Hello")).toBe("_Hello");
	});

	test("all examples from doc comment work correctly", () => {
		expect(lowercaseFirst("Hello World")).toBe("hello World");
		expect(lowercaseFirst("Hello_World")).toBe("hello_World");
	});
});

describe(uppercase, () => {
	test("converts entire string to uppercase", () => {
		expect(uppercase("hello world")).toBe("HELLO WORLD");
		expect(uppercase("hello_world")).toBe("HELLO_WORLD");
		expect(uppercase("helloWorld")).toBe("HELLOWORLD");
	});

	test("handles already uppercase strings", () => {
		expect(uppercase("HELLO WORLD")).toBe("HELLO WORLD");
	});

	test("handles empty and edge cases", () => {
		expect(uppercase("")).toBe("");
		expect(uppercase("a")).toBe("A");
	});

	test("handles mixed content", () => {
		expect(uppercase("Hello123World")).toBe("HELLO123WORLD");
		expect(uppercase("test-value_123")).toBe("TEST-VALUE_123");
	});

	test("all examples from doc comment work correctly", () => {
		expect(uppercase("hello world")).toBe("HELLO WORLD");
		expect(uppercase("hello_world")).toBe("HELLO_WORLD");
	});
});

describe(lowercase, () => {
	test("converts entire string to lowercase", () => {
		expect(lowercase("HELLO WORLD")).toBe("hello world");
		expect(lowercase("Hello_World")).toBe("hello_world");
		expect(lowercase("HelloWorld")).toBe("helloworld");
	});

	test("handles already lowercase strings", () => {
		expect(lowercase("hello world")).toBe("hello world");
	});

	test("handles empty and edge cases", () => {
		expect(lowercase("")).toBe("");
		expect(lowercase("A")).toBe("a");
	});

	test("handles mixed content", () => {
		expect(lowercase("Hello123World")).toBe("hello123world");
		expect(lowercase("TEST-VALUE_123")).toBe("test-value_123");
	});

	test("all examples from doc comment work correctly", () => {
		expect(lowercase("HELLO WORLD")).toBe("hello world");
		expect(lowercase("Hello_World")).toBe("hello_world");
	});
});
describe(splitWords, () => {
	test("splits on runs of spaces, hyphens, underscores (no spaces)", () => {
		expect(splitWords("foo-bar")).toEqual(["foo", "bar"]);
		expect(splitWords("foo_bar")).toEqual(["foo", "bar"]);
		expect(splitWords("foo---bar")).toEqual(["foo", "bar"]);
		expect(splitWords("foo___bar")).toEqual(["foo", "bar"]);
	});

	test("splits only on spaces when string contains spaces", () => {
		expect(splitWords("foo bar")).toEqual(["foo", "bar"]);
		expect(splitWords("foo   bar")).toEqual(["foo", "bar"]);
		expect(splitWords("foo - _ bar")).toEqual(["foo", "-", "_", "bar"]);
	});

	test("splits on lowercase to uppercase transition (camelCase)", () => {
		expect(splitWords("fooBar")).toEqual(["foo", "Bar"]);
		expect(splitWords("helloWorld")).toEqual(["hello", "World"]);
		expect(splitWords("myVariableName")).toEqual(["my", "Variable", "Name"]);
	});

	test("splits consecutive capitals before lowercase (acronyms)", () => {
		expect(splitWords("XMLParser")).toEqual(["XML", "Parser"]);
		expect(splitWords("HTTPSConnection")).toEqual(["HTTPS", "Connection"]);
		expect(splitWords("myXMLParser")).toEqual(["my", "XML", "Parser"]);
		expect(splitWords("parseHTMLString")).toEqual(["parse", "HTML", "String"]);
	});

	test("splits on digit boundaries", () => {
		expect(splitWords("hello2World")).toEqual(["hello", "2", "World"]);
		expect(splitWords("test123abc")).toEqual(["test", "123", "abc"]);
		expect(splitWords("version2")).toEqual(["version", "2"]);
		expect(splitWords("2fast")).toEqual(["2", "fast"]);
	});

	test("handles PascalCase", () => {
		expect(splitWords("HelloWorld")).toEqual(["Hello", "World"]);
		expect(splitWords("MyClass")).toEqual(["My", "Class"]);
	});

	test("handles mixed separators with spaces (splits only on spaces)", () => {
		expect(splitWords("foo_bar-baz test")).toEqual(["foo_bar-baz", "test"]);
		expect(splitWords("hello_world-test case")).toEqual(["hello_world-test", "case"]);
	});

	test("handles mixed separators without spaces (smart split)", () => {
		expect(splitWords("foo_bar-baz")).toEqual(["foo", "bar", "baz"]);
		expect(splitWords("hello_world-test")).toEqual(["hello", "world", "test"]);
	});

	test("handles all uppercase", () => {
		expect(splitWords("HELLO")).toEqual(["HELLO"]);
		expect(splitWords("HELLO_WORLD")).toEqual(["HELLO", "WORLD"]);
	});

	test("handles all lowercase", () => {
		expect(splitWords("hello")).toEqual(["hello"]);
		expect(splitWords("hello world")).toEqual(["hello", "world"]);
	});

	test("handles leading/trailing separators", () => {
		expect(splitWords("_hello_")).toEqual(["hello"]);
		expect(splitWords("-test-")).toEqual(["test"]);
		expect(splitWords("  hello  ")).toEqual(["hello"]);
		expect(splitWords("_-hello-_")).toEqual(["hello"]);
	});

	test("handles empty and single character", () => {
		expect(splitWords("")).toEqual([]);
		expect(splitWords("a")).toEqual(["a"]);
		expect(splitWords("A")).toEqual(["A"]);
	});

	test("custom splitOn: RegExp", () => {
		expect(splitWords("foo.bar.baz", { splitOn: /\./ })).toEqual(["foo", "bar", "baz"]);
		expect(splitWords("a|b|c", { splitOn: /\|/ })).toEqual(["a", "b", "c"]);
	});

	test("custom splitOn: string (creates character class)", () => {
		expect(splitWords("foo.bar,baz", { splitOn: ".," })).toEqual(["foo", "bar", "baz"]);
		expect(splitWords("a:b;c", { splitOn: ":;" })).toEqual(["a", "b", "c"]);
		expect(splitWords("foo|bar|baz", { splitOn: "|" })).toEqual(["foo", "bar", "baz"]);
	});

	test("whitespace-only input defaults to whitespace splitting", () => {
		expect(splitWords("foo bar baz")).toEqual(["foo", "bar", "baz"]);
		expect(splitWords("hello world test")).toEqual(["hello", "world", "test"]);
	});

	test("no whitespace uses complex splitting", () => {
		expect(splitWords("fooBarBaz")).toEqual(["foo", "Bar", "Baz"]);
		expect(splitWords("foo_bar_baz")).toEqual(["foo", "bar", "baz"]);
	});

	test("complex real-world examples", () => {
		expect(splitWords("myXMLParser2Fast")).toEqual(["my", "XML", "Parser", "2", "Fast"]);
		expect(splitWords("parseHTTP2Response")).toEqual(["parse", "HTTP", "2", "Response"]);
		expect(splitWords("GET_USER_BY_ID")).toEqual(["GET", "USER", "BY", "ID"]);
		expect(splitWords("iPhone12Pro")).toEqual(["i", "Phone", "12", "Pro"]);
	});

	test("edge case: consecutive digits", () => {
		expect(splitWords("test123")).toEqual(["test", "123"]);
		expect(splitWords("123test")).toEqual(["123", "test"]);
		expect(splitWords("a1b2c3")).toEqual(["a", "1", "b", "2", "c", "3"]);
	});

	test("filters empty strings from result", () => {
		expect(splitWords("___")).toEqual([]);
		expect(splitWords("---")).toEqual([]);
		expect(splitWords("   ")).toEqual([]);
	});

	test("all examples from doc comment work correctly", () => {
		expect(splitWords("helloWorld")).toEqual(["hello", "World"]);
		expect(splitWords("foo_bar-baz")).toEqual(["foo", "bar", "baz"]);
		expect(splitWords("XMLParser")).toEqual(["XML", "Parser"]);
		expect(splitWords("hello2World")).toEqual(["hello", "2", "World"]);
		expect(splitWords("hello world")).toEqual(["hello", "world"]);
		expect(splitWords("An amuse-bouche")).toEqual(["An", "amuse-bouche"]);
		expect(splitWords("foo..bar", { splitOn: "." })).toEqual(["foo", "bar"]);
		expect(splitWords("a,b;c", { splitOn: /[,;]/ })).toEqual(["a", "b", "c"]);
	});
});
