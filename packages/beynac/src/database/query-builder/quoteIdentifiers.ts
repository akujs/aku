import type { SqlDialect } from "./dialect.ts";

interface DialectConfig {
	// Skip zones to check
	backslashStringEscape: boolean; // MySQL uses \' in addition to ''
	backtickIdentifiers: boolean; // SQLite, MySQL
	bracketIdentifiers: boolean; // SQLite, SQL Server
	hashComments: boolean; // MySQL
	dollarQuotes: boolean; // PostgreSQL
	eStrings: boolean; // PostgreSQL
	nestedBlockComments: boolean; // PostgreSQL, SQL Server

	// Output quote style
	outputQuote: string;
	outputQuoteClose: string;
}

const DIALECTS: Record<SqlDialect, DialectConfig> = {
	postgresql: {
		backslashStringEscape: false,
		backtickIdentifiers: false,
		bracketIdentifiers: false,
		hashComments: false,
		dollarQuotes: true,
		eStrings: true,
		nestedBlockComments: true,
		outputQuote: '"',
		outputQuoteClose: '"',
	},
	sqlite: {
		backslashStringEscape: false,
		backtickIdentifiers: true,
		bracketIdentifiers: true,
		hashComments: false,
		dollarQuotes: false,
		eStrings: false,
		nestedBlockComments: false,
		outputQuote: '"',
		outputQuoteClose: '"',
	},
	mysql: {
		backslashStringEscape: true,
		backtickIdentifiers: true,
		bracketIdentifiers: false,
		hashComments: true,
		dollarQuotes: false,
		eStrings: false,
		nestedBlockComments: false,
		outputQuote: "`",
		outputQuoteClose: "`",
	},
	sqlserver: {
		backslashStringEscape: false,
		backtickIdentifiers: false,
		bracketIdentifiers: true,
		hashComments: false,
		dollarQuotes: false,
		eStrings: false,
		nestedBlockComments: true,
		outputQuote: "[",
		outputQuoteClose: "]",
	},
};

export function quoteIdentifiers(sql: string, dialect: SqlDialect): string {
	const config = DIALECTS[dialect];
	const len = sql.length;
	let pos = 0;
	let result: string[] | null = null;
	let lastEnd = 0;

	while (pos < len) {
		const char = sql.charCodeAt(pos);

		// Skip zones - bypass without checking for identifiers

		// Single-quoted strings
		if (char === SINGLE_QUOTE) {
			pos = scanQuoted(sql, pos, SINGLE_QUOTE, config.backslashStringEscape);
			continue;
		}

		// Double-quoted identifiers (all dialects support this)
		if (char === DOUBLE_QUOTE) {
			pos = scanQuoted(sql, pos, DOUBLE_QUOTE, false);
			continue;
		}

		// Backtick identifiers (SQLite, MySQL)
		if (config.backtickIdentifiers && char === BACKTICK) {
			pos = scanQuoted(sql, pos, BACKTICK, false);
			continue;
		}

		// Bracket identifiers (SQLite, SQL Server)
		if (config.bracketIdentifiers && char === OPEN_BRACKET) {
			pos = scanToChar(sql, pos + 1, CLOSE_BRACKET);
			continue;
		}

		// Dollar quotes and positional params (PostgreSQL)
		if (config.dollarQuotes && char === DOLLAR) {
			const newPos = scanDollarQuote(sql, pos);
			if (newPos !== pos) {
				pos = newPos;
				continue;
			}
		}

		// Line comments: --
		if (char === HYPHEN && sql.charCodeAt(pos + 1) === HYPHEN) {
			pos = scanToNewline(sql, pos + 2);
			continue;
		}

		// Hash comments (MySQL): #
		if (config.hashComments && char === HASH) {
			pos = scanToNewline(sql, pos + 1);
			continue;
		}

		// Block comments: /* */
		if (char === SLASH && sql.charCodeAt(pos + 1) === STAR) {
			pos = scanBlockComment(sql, pos + 2, config.nestedBlockComments);
			continue;
		}

		// Check for identifiers
		if (isIdentStart(char)) {
			const start = pos;
			pos = scanIdentifier(sql, pos);
			const ident = sql.slice(start, pos);

			// E-string: single E/e followed by quote needs backslash-escape handling
			if (
				config.eStrings &&
				ident.length === 1 &&
				(char === E_UPPER || char === E_LOWER) &&
				sql.charCodeAt(pos) === SINGLE_QUOTE
			) {
				pos = scanQuoted(sql, pos, SINGLE_QUOTE, true);
				continue;
			}

			// Quote identifiers with lowercase letters.
			// Only ALL_CAPS identifiers (SELECT, WHERE, TRUE) are left unquoted.
			if (hasLowercase(ident)) {
				result ??= [];
				result.push(sql.slice(lastEnd, start));
				result.push(config.outputQuote + ident + config.outputQuoteClose);
				lastEnd = pos;
			}
			continue;
		}

		// Numeric literals - skip to avoid quoting parts of hex (0xFF), scientific (1e10), etc.
		if (char >= ZERO && char <= NINE) {
			pos++;
			while (pos < len && isIdentCont(sql.charCodeAt(pos))) {
				pos++;
			}
			continue;
		}

		// Skip everything else (operators, punctuation, whitespace)
		pos++;
	}

	// Return original string if no changes (zero allocation)
	if (result === null) {
		return sql;
	}

	result.push(sql.slice(lastEnd));
	return result.join("");
}

// =============================================================================
// Character Constants
// =============================================================================

const SINGLE_QUOTE = "'".charCodeAt(0);
const DOUBLE_QUOTE = '"'.charCodeAt(0);
const BACKTICK = "`".charCodeAt(0);
const OPEN_BRACKET = "[".charCodeAt(0);
const CLOSE_BRACKET = "]".charCodeAt(0);
const DOLLAR = "$".charCodeAt(0);
const HYPHEN = "-".charCodeAt(0);
const HASH = "#".charCodeAt(0);
const SLASH = "/".charCodeAt(0);
const STAR = "*".charCodeAt(0);
const BACKSLASH = "\\".charCodeAt(0);
const NEWLINE = "\n".charCodeAt(0);
const RETURN = "\r".charCodeAt(0);
const A_UPPER = "A".charCodeAt(0);
const Z_UPPER = "Z".charCodeAt(0);
const E_UPPER = "E".charCodeAt(0);
const E_LOWER = "e".charCodeAt(0);
const A_LOWER = "a".charCodeAt(0);
const Z_LOWER = "z".charCodeAt(0);
const ZERO = "0".charCodeAt(0);
const NINE = "9".charCodeAt(0);
const UNDERSCORE = "_".charCodeAt(0);
const HIGH_BIT_START = 0x80;

// =============================================================================
// Identifier Functions
// =============================================================================

function isIdentStart(char: number): boolean {
	return (
		(char >= A_UPPER && char <= Z_UPPER) ||
		(char >= A_LOWER && char <= Z_LOWER) ||
		char === UNDERSCORE ||
		char >= HIGH_BIT_START
	);
}

function isIdentCont(char: number): boolean {
	return isIdentStart(char) || (char >= ZERO && char <= NINE) || char === DOLLAR;
}

function scanIdentifier(sql: string, pos: number): number {
	const len = sql.length;
	pos++;
	while (pos < len && isIdentCont(sql.charCodeAt(pos))) {
		pos++;
	}
	return pos;
}

function hasLowercase(ident: string): boolean {
	for (let i = 0; i < ident.length; i++) {
		const char = ident.charCodeAt(i);
		if (char >= A_LOWER && char <= Z_LOWER) {
			return true;
		}
	}
	return false;
}

function scanToNewline(sql: string, pos: number): number {
	const len = sql.length;
	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === NEWLINE || char === RETURN) {
			return pos + 1;
		}
		pos++;
	}
	return pos;
}

// Scan to a specific character (for bracket identifiers).
// Returns position after the character, or end of string.
function scanToChar(sql: string, pos: number, endChar: number): number {
	const len = sql.length;
	while (pos < len) {
		if (sql.charCodeAt(pos) === endChar) {
			return pos + 1;
		}
		pos++;
	}
	return pos;
}

// Scan quoted content (strings and identifiers).
// Handles doubled-quote escape ('' or "" or ``).
// Optionally handles backslash escape (\' etc) for MySQL.
function scanQuoted(sql: string, pos: number, quoteChar: number, backslashEscape: boolean): number {
	const len = sql.length;
	pos++; // skip opening quote
	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === quoteChar) {
			if (sql.charCodeAt(pos + 1) === quoteChar) {
				pos += 2; // doubled quote escape
			} else {
				return pos + 1; // end of quoted content
			}
		} else if (backslashEscape && char === BACKSLASH) {
			pos += 2; // skip backslash and next char
		} else {
			pos++;
		}
	}
	return pos; // unterminated
}

// Scan block comment, optionally with nesting support.
// PostgreSQL and SQL Server support nested comments; SQLite and MySQL don't.
function scanBlockComment(sql: string, pos: number, nested: boolean): number {
	const len = sql.length;
	let depth = 1;

	while (pos < len && depth > 0) {
		const char = sql.charCodeAt(pos);
		if (nested && char === SLASH && sql.charCodeAt(pos + 1) === STAR) {
			depth++;
			pos += 2;
		} else if (char === STAR && sql.charCodeAt(pos + 1) === SLASH) {
			depth--;
			pos += 2;
		} else {
			pos++;
		}
	}
	return pos;
}

// Scan dollar quote (PostgreSQL) or positional parameter.
// Returns original position if not a valid dollar construct.
function scanDollarQuote(sql: string, pos: number): number {
	const len = sql.length;
	const startPos = pos;
	pos++; // skip first $

	// Check if this is a positional parameter $1, $2, etc.
	if (pos < len) {
		const nextChar = sql.charCodeAt(pos);
		if (nextChar >= ZERO && nextChar <= NINE) {
			while (pos < len) {
				const c = sql.charCodeAt(pos);
				if (c >= ZERO && c <= NINE) {
					pos++;
				} else {
					break;
				}
			}
			return pos;
		}
	}

	// Try to parse as dollar quote tag: $tag$ or $$
	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === DOLLAR) {
			// Found closing $ of tag
			pos++;
			const tag = sql.slice(startPos, pos);

			// Now scan for matching closing tag
			while (pos < len) {
				if (sql.charCodeAt(pos) === DOLLAR) {
					if (sql.slice(pos, pos + tag.length) === tag) {
						return pos + tag.length;
					}
				}
				pos++;
			}
			return pos; // unterminated dollar quote - skip to end
		} else if (isIdentStart(char) || (char >= ZERO && char <= NINE)) {
			pos++;
		} else {
			// Not a valid tag character (e.g. $@), so not a dollar quote.
			// Return to main loop which will skip $ and process rest normally.
			return startPos;
		}
	}

	// Reached end of input while reading tag (e.g. $tag with no closing $).
	// This is not a dollar quote - it's $ operator followed by identifier.
	// Return to main loop which will skip $ and process the identifier.
	return startPos;
}
