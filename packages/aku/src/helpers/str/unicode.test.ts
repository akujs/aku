import { describe, expect, test } from "bun:test";
import { slug, stringWithoutComplexChars, stringWithoutMarks, transliterate } from "./unicode.ts";

describe(stringWithoutMarks, () => {
	test("removes accents from French text", () => {
		expect(stringWithoutMarks("Crème Brûlée")).toBe("Creme Brulee");
	});

	test("removes accents from single word", () => {
		expect(stringWithoutMarks("café")).toBe("cafe");
	});

	test("decomposes ligatures", () => {
		expect(stringWithoutMarks("ﬁle")).toBe("file");
	});

	test("handles already ASCII text", () => {
		expect(stringWithoutMarks("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		expect(stringWithoutMarks("")).toBe("");
	});

	test("handles mixed accented characters", () => {
		expect(stringWithoutMarks("àáâãäåèéêëìíîïòóôõöùúûü")).toBe("aaaaaaeeeeiiiiooooouuuu");
	});

	test("preserves case", () => {
		expect(stringWithoutMarks("CAFÉ")).toBe("CAFE");
	});

	test("removes Devanagari vowel signs (Mark but not Diacritic)", () => {
		// Devanagari vowel sign AA (U+093E) is Spacing_Mark (Mc), not in \p{Diacritic}
		expect(stringWithoutMarks("का")).toBe("क");
	});

	test("preserves Latin-1 characters when allowLatin1 is true", () => {
		expect(stringWithoutMarks("café", { allowLatin1: true })).toBe("café");
		expect(stringWithoutMarks("Crème Brûlée", { allowLatin1: true })).toBe("Crème Brûlée");
	});

	test("decomposes non-Latin1 sequences when allowLatin1 is true", () => {
		// Devanagari vowel signs (outside Latin-1) are decomposed
		expect(stringWithoutMarks("का", { allowLatin1: true })).toBe("क");
		// Vietnamese precomposed characters (Latin Extended-A) are outside Latin-1 and get decomposed
		expect(stringWithoutMarks("ế", { allowLatin1: true })).toBe("e"); // U+1EBF is outside Latin-1
	});

	test("edge cases with allowLatin1: surrogate pairs and mixed content", () => {
		// Emojis (surrogate pairs, U+1F600+) - should be preserved
		expect(stringWithoutMarks("café💯test", { allowLatin1: true })).toBe("café💯test");
		// Variation selectors (U+FE0F) are combining marks and get removed
		expect(stringWithoutMarks("❤️", { allowLatin1: true })).toBe("❤"); // ❤️ (with variation selector) → ❤ (without)

		// Mixed Latin-1 + CJK
		expect(stringWithoutMarks("café北京", { allowLatin1: true })).toBe("café北京");

		// Boundary testing: characters right at Latin-1 edge
		// ÿ (U+00FF, Latin-1) preserved, Ā (U+0100, Latin Extended-A) decomposed to A
		expect(stringWithoutMarks("\u00FF\u0100", { allowLatin1: true })).toBe("\u00FFA"); // ÿĀ → ÿA

		// Multiple non-Latin1 sequences with Latin-1 in between
		expect(stringWithoutMarks("café北京résumé日本", { allowLatin1: true })).toBe(
			"café北京résumé日本",
		);

		// Combining marks on non-Latin1 base characters
		expect(stringWithoutMarks("北\u0301京", { allowLatin1: true })).toBe("北京"); // 北 + combining acute accent

		// Zero-width characters and invisible marks
		expect(stringWithoutMarks("test\u200Bcafé\u200B", { allowLatin1: true })).toBe(
			"test\u200Bcafé\u200B",
		); // zero-width space

		// Hangul (precomposed and will re-compose after NFC)
		expect(stringWithoutMarks("한글", { allowLatin1: true })).toBe("한글");

		// Mathematical alphanumerics (outside BMP initially, but NFKD decomposes them)
		expect(stringWithoutMarks("𝐇𝐞𝐥𝐥𝐨", { allowLatin1: true })).toBe("Hello"); // U+1D407 etc. → H e l l o via NFKD
	});
});

describe(stringWithoutComplexChars, () => {
	test("removes non-ASCII characters", () => {
		expect(stringWithoutComplexChars("café")).toBe("caf");
		expect(stringWithoutComplexChars("北京")).toBe("");
		expect(stringWithoutComplexChars("Hello❤️World")).toBe("HelloWorld");
	});

	test("preserves ASCII printable characters", () => {
		expect(stringWithoutComplexChars("hello world 123!")).toBe("hello world 123!");
	});

	test("removes control characters", () => {
		expect(stringWithoutComplexChars("\x00\x1Ftext")).toBe("text");
		expect(stringWithoutComplexChars("hello\nworld")).toBe("helloworld");
	});

	test("preserves Latin-1 when allowLatin1 is true", () => {
		expect(stringWithoutComplexChars("café", { target: "latin1" })).toBe("café");
		expect(stringWithoutComplexChars("Crème Brûlée", { target: "latin1" })).toBe("Crème Brûlée");
	});

	test("removes non-Latin1 when allowLatin1 is true", () => {
		expect(stringWithoutComplexChars("北京café", { target: "latin1" })).toBe("café");
		expect(stringWithoutComplexChars("Hello❤️World", { target: "latin1" })).toBe("HelloWorld");
	});

	test("uses replacement string", () => {
		expect(stringWithoutComplexChars("café", { replacement: "?" })).toBe("caf?");
		expect(stringWithoutComplexChars("北京", { replacement: "?" })).toBe("??");
		// Note: Some emojis are multiple code points (e.g., ❤️ = heart + variation selector)
		expect(stringWithoutComplexChars("Hello❤World", { replacement: " " })).toBe("Hello World");
	});

	test("handles empty string", () => {
		expect(stringWithoutComplexChars("")).toBe("");
	});
});

describe(transliterate, () => {
	test("converts German umlauts with multi-character expansion", () => {
		expect(transliterate("Größe")).toBe("Groesse");
	});

	test("converts German ß to ss", () => {
		expect(transliterate("Straße")).toBe("Strasse");
	});

	test("imported", () => {
		expect(transliterate("Я люблю единорогов")).toBe("Ya lyublyu edinorogov");
		expect(transliterate("'أنا أحب حيدات'")).toBe("'ana ahb hydat'");
		// Vietnamese diacritics are now handled by transliterate (which includes stringWithoutMarks)
		expect(transliterate("tôi yêu những chú kỳ lân")).toBe("toi yeu nhung chu ky lan");
		expect(transliterate("En–dashes and em—dashes are normalized")).toBe(
			"En-dashes and em-dashes are normalized",
		);
		expect(transliterate("Fußgängerübergänge")).toBe("Fussgaengeruebergaenge");
	});

	test("converts all German umlauts", () => {
		expect(transliterate("äöü ÄÖÜ ß")).toBe("aeoeue AeOeUe ss");
	});

	test("converts ligatures", () => {
		expect(transliterate("æther")).toBe("aether");
		expect(transliterate("Æon")).toBe("AEon");
		expect(transliterate("œuvre")).toBe("oeuvre");
	});

	test("converts emoji", () => {
		expect(transliterate("💯")).toBe("100");
	});

	test("converts currency symbols", () => {
		expect(transliterate("€50")).toBe("E50");
		expect(transliterate("¥100")).toBe("Y100");
	});

	test("handles already ASCII text", () => {
		expect(transliterate("hello world")).toBe("hello world");
	});

	test("handles empty string", () => {
		expect(transliterate("")).toBe("");
	});

	test("converts Nordic characters", () => {
		// Ø and Å are handled by stringWithoutMarks via NFKD normalization (now included in transliterate)
		expect(transliterate("Ø")).toBe("O");
		expect(transliterate("Å")).toBe("A");
	});

	test("converts Icelandic thorn", () => {
		expect(transliterate("Þ")).toBe("TH");
		expect(transliterate("þ")).toBe("th");
	});

	test("preserves characters not in table", () => {
		expect(transliterate("hello")).toBe("hello");
		expect(transliterate("123")).toBe("123");
	});

	test("handles multi-character Russian sequences", () => {
		// Russian: ъе → ye, Ъе → Ye (note: Ъ + е, not Ъ + Е)
		expect(transliterate("подъезд")).toBe("podyezd"); // под + ъе + зд
		expect(transliterate("Подъезд")).toBe("Podyezd"); // Под + ъе + зд (lowercase е)
		expect(transliterate("ПодЪезд")).toBe("PodYezd"); // Под + Ъе + зд (capital Ъ)
		expect(transliterate("белый")).toBe("beliy"); // бел + ый
		expect(transliterate("Белый")).toBe("Beliy"); // Бел + ый (lowercase ый)
		expect(transliterate("БелЫй")).toBe("BelIy"); // Бел + Ый (capital Ы)
	});

	test("handles Arabic diacritics with invisible characters", () => {
		// Arabic combining marks that include LTR mark (U+200E)
		expect(transliterate("مَ‎")).toBe("ma"); // م + َ‎ (fatha with LTR mark)
		expect(transliterate("مِ‎")).toBe("mi"); // م + ِ‎ (kasra with LTR mark)
	});

	test("allowLatin1 option preserves Latin-1 characters", () => {
		// Without allowLatin1, combining marks are removed
		expect(transliterate("café")).toBe("cafe");
		expect(transliterate("Crème Brûlée")).toBe("Creme Brulee");

		// With allowLatin1, Latin-1 characters are preserved (U+00A0-U+00FF)
		expect(transliterate("café", { allowLatin1: true })).toBe("café");
		expect(transliterate("Crème Brûlée", { allowLatin1: true })).toBe("Crème Brûlée");

		// Vietnamese ô (U+00F4) and ê (U+00EA) are IN Latin-1 range, so preserved with allowLatin1
		expect(transliterate("tôi yêu", { allowLatin1: true })).toBe("tôi yêu");

		// But characters outside Latin-1 are still decomposed (e.g., ế = U+1EBF)
		expect(transliterate("ế", { allowLatin1: true })).toBe("e");
	});
});

describe(slug, () => {
	// Basic whitespace handling
	test("replaces spaces with separator", () => {
		expect(slug("hello world")).toBe("hello-world");
	});

	test("collapses multiple spaces", () => {
		expect(slug("hello  world")).toBe("hello-world");
	});

	test("trims whitespace from ends", () => {
		expect(slug("  hello world  ")).toBe("hello-world");
	});

	test("handles text with control characters removed", () => {
		// stringWithoutComplexChars removes control characters like \n and \t (outside ASCII printable 0x20-0x7E)
		expect(slug("hello\nworld")).toBe("helloworld");
		expect(slug("hello\tworld")).toBe("helloworld");
	});

	test("runs of spaces become single separator", () => {
		expect(slug("a    b")).toBe("a-b");
	});

	// Default dictionary replacements
	test("default dictionary: @, &, %, +", () => {
		expect(slug("A@B&C%D+E")).toBe("a-at-b-and-c-percent-d-plus-e");
	});

	test("replacements get spaces around them", () => {
		expect(slug("100%test")).toBe("100-percent-test");
		expect(slug("user@host")).toBe("user-at-host");
	});

	// Options: custom replacements
	test("options.replacements with custom object", () => {
		expect(slug("x@y%z", { replacements: { "%": "pct" } })).toBe("xy-pct-z");
	});

	test("options.replacements with true uses defaults", () => {
		expect(slug("x@y&z%w", { replacements: true })).toBe("x-at-y-and-z-percent-w");
	});

	test("options.replacements with false disables replacements", () => {
		expect(slug("x@y&z%w", { replacements: false })).toBe("xyzw");
	});

	// Options: separator
	test("options.separator", () => {
		expect(slug("hello world", { separator: "_" })).toBe("hello_world");
		expect(slug("foo-bar", { separator: "_" })).toBe("foo-bar"); // hyphen is URL-safe, preserved
	});

	// Character handling (slug always applies full pipeline)
	test("removes URL reserved characters", () => {
		expect(slug("hello! world?")).toBe("hello-world");
		expect(slug("foo*bar")).toBe("foobar");
		expect(slug("path/to/file")).toBe("path-to-file");
	});

	test("keeps unreserved URL characters", () => {
		expect(slug("hello-world")).toBe("hello-world");
		expect(slug("foo_bar")).toBe("foo_bar");
		expect(slug("hello~world")).toBe("hello~world");
	});

	// Options: lowercase
	test("options.lowercase control", () => {
		expect(slug("Hello World", { lowercase: false })).toBe("Hello-World");
	});

	// Intra-word marks (removed without space)
	test("removes quotes and apostrophes", () => {
		expect(slug("don't")).toBe("dont");
		expect(slug('it\'s "quoted"')).toBe("its-quoted");
		expect(slug('"hello"')).toBe("hello");
		expect(slug("café's")).toBe("cafes");
	});

	// Inter-word marks (replaced with space)
	test("replaces em/en dash with space", () => {
		expect(slug("hello—world")).toBe("hello-world");
		expect(slug("hello–world")).toBe("hello-world");
	});

	test("replaces slash/pipe/semicolon with space", () => {
		expect(slug("path/to/file")).toBe("path-to-file");
		expect(slug("A|B")).toBe("a-b");
		expect(slug("foo;bar")).toBe("foo-bar");
	});

	// Other character handling
	test("preserves numbers", () => {
		expect(slug("test 123 example")).toBe("test-123-example");
	});

	test("removes other special characters", () => {
		expect(slug("foo=bar")).toBe("foobar");
	});

	// Edge cases
	test("handles empty string", () => {
		expect(slug("")).toBe("");
	});

	test("handles only special characters", () => {
		expect(slug("!!!")).toBe("");
		expect(slug("@@@", { replacements: {} })).toBe("");
	});

	// Documentation examples
	test("all examples from doc comment work correctly", () => {
		expect(slug("Größe café")).toBe("groesse-cafe");
		expect(slug("hello  world")).toBe("hello-world");
		expect(slug("email@example")).toBe("email-at-example");
		expect(slug("Tom & Jerry")).toBe("tom-and-jerry");
		expect(slug("100%")).toBe("100-percent");
		expect(slug("hello world", { separator: "_" })).toBe("hello_world");
		expect(slug("100%", { replacements: { "%": "pct" } })).toBe("100-pct");
		expect(slug("café!", { replacements: false })).toBe("cafe");
		expect(slug("Hello", { lowercase: false })).toBe("Hello");
	});

	// Complex integration tests
	test("handles complex mixed content", () => {
		expect(slug("Crème Brûlée @ €50!")).toBe("creme-brulee-at-e50");
		expect(slug("Tom & Jerry—The Movie!")).toBe("tom-and-jerry-the-movie");
		expect(slug('100% "success" rate')).toBe("100-percent-success-rate");
	});

	test("multiple options combined", () => {
		expect(
			slug("Größe 100%", {
				separator: "_",
				replacements: { "%": "pct" },
				lowercase: false,
			}),
		).toBe("Groesse_100_pct");
	});
});
