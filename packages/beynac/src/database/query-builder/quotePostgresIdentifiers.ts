export function quotePostgresIdentifiers(sql: string): string {
	const len = sql.length;
	let pos = 0;
	let result: string[] | null = null;
	let lastEnd = 0;

	while (pos < len) {
		const char = sql.charCodeAt(pos);

		// Skip zones - bypass without checking for identifiers
		if (char === SINGLE_QUOTE) {
			pos = getQuotedStringEnd(sql, pos, SINGLE_QUOTE);
			continue;
		}
		if (char === DOUBLE_QUOTE) {
			pos = getQuotedStringEnd(sql, pos, DOUBLE_QUOTE);
			continue;
		}
		if (char === DOLLAR) {
			const newPos = getDollarTokenEnd(sql, pos);
			if (newPos !== pos) {
				pos = newPos;
				continue;
			}
		}
		if (char === HYPHEN && sql.charCodeAt(pos + 1) === HYPHEN) {
			pos = getLineCommentEnd(sql, pos);
			continue;
		}
		if (char === SLASH && sql.charCodeAt(pos + 1) === STAR) {
			pos = getBlockCommentEnd(sql, pos);
			continue;
		}

		if (isIdentStart(char)) {
			const start = pos;
			pos = getIdentifierEnd(sql, pos);
			const ident = sql.slice(start, pos);

			// E-string: single E/e followed by quote needs backslash-escape handling
			if (
				ident.length === 1 &&
				(char === E_UPPER || char === E_LOWER) &&
				sql.charCodeAt(pos) === SINGLE_QUOTE
			) {
				pos = getEscapeStringEnd(sql, pos);
				continue;
			}

			// Quote identifiers with lowercase letters.
			// Only ALL_CAPS identifiers (SELECT, WHERE, TRUE) are left unquoted.
			if (hasLowercase(ident)) {
				// Need to quote this identifier
				result ??= [];
				result.push(sql.slice(lastEnd, start));
				result.push('"' + ident + '"');
				lastEnd = pos;
			}
			continue;
		}

		// Skip everything else (operators, numbers, punctuation, whitespace)
		pos++;
	}

	if (result == null) {
		return sql;
	}

	result.push(sql.slice(lastEnd));
	return result.join("");
}

const SINGLE_QUOTE = "'".charCodeAt(0);
const DOUBLE_QUOTE = '"'.charCodeAt(0);
const DOLLAR = "$".charCodeAt(0);
const HYPHEN = "-".charCodeAt(0);
const SLASH = "/".charCodeAt(0);
const STAR = "*".charCodeAt(0);
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

function getIdentifierEnd(sql: string, pos: number): number {
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

function getQuotedStringEnd(sql: string, pos: number, quoteChar: number): number {
	const len = sql.length;
	pos++; // skip opening quote
	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === quoteChar) {
			if (sql.charCodeAt(pos + 1) === quoteChar) {
				pos += 2; // double quote is escape sequence
			} else {
				return pos + 1; // end of string
			}
		} else {
			pos++;
		}
	}
	return pos; // unterminated string - skip to end
}

function getDollarTokenEnd(sql: string, pos: number): number {
	const len = sql.length;
	const startPos = pos;
	pos++; // skip first $

	// Check if this is a positional parameter $1, $2, etc.
	if (pos < len) {
		const nextChar = sql.charCodeAt(pos);
		if (nextChar >= ZERO && nextChar <= NINE) {
			// It's a parameter like $1, $2
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
	// Tag can be empty or identifier-like (but no $)
	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === DOLLAR) {
			// Found closing $ of tag
			pos++;
			const tag = sql.slice(startPos, pos);

			// Now scan for matching closing tag
			while (pos < len) {
				if (sql.charCodeAt(pos) === DOLLAR) {
					// Check if this is our closing tag
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

function getLineCommentEnd(sql: string, pos: number): number {
	const len = sql.length;
	pos += 2; // skip --
	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === NEWLINE || char === RETURN) {
			return pos + 1;
		}
		pos++;
	}
	return pos; // end of input
}

function getBlockCommentEnd(sql: string, pos: number): number {
	const len = sql.length;
	pos += 2; // skip /*
	let depth = 1;

	while (pos < len && depth > 0) {
		const char = sql.charCodeAt(pos);
		if (char === SLASH && sql.charCodeAt(pos + 1) === STAR) {
			depth++;
			pos += 2;
		} else if (char === STAR && sql.charCodeAt(pos + 1) === SLASH) {
			depth--;
			pos += 2;
		} else {
			pos++;
		}
	}
	return pos; // end of input
}

function getEscapeStringEnd(sql: string, pos: number): number {
	// E'...' strings allow backslash escapes
	const len = sql.length;
	pos++; // skip opening '

	while (pos < len) {
		const char = sql.charCodeAt(pos);
		if (char === SINGLE_QUOTE) {
			if (sql.charCodeAt(pos + 1) === SINGLE_QUOTE) {
				pos += 2; // escaped ''
			} else {
				return pos + 1; // end of string
			}
		} else if (char === 92) {
			// backslash
			pos += 2; // skip backslash and next char
		} else {
			pos++;
		}
	}
	return pos;
}
