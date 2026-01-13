import { transliterate, withoutComplexChars } from "../str/unicode.ts";

const NON_LATIN1_REGEXP = /[^\x20-\x7e\xa0-\xff]/g;

/***/
export interface HeaderValueWithAttributes {
	/**
	 * The header value (e.g., 'attachment', 'inline')
	 */
	value: string;
	/**
	 * Attributes from the header e.g. { filename: 'example.txt' }
	 */
	attributes: Record<string, string | undefined>;
}

/**
 * Generate a Content-Disposition "attachment" header
 *
 * @param filename
 * @param options.fallback either an ASCII file name to use as a fallback for clients that don't support unicode file names, or `false` to disable the default behaviour of automatically generating a fallback by stripping unicode characters
 */
export function contentDisposition(
	filename: string,
	options?: {
		fallback?: string | boolean;
	},
): string {
	const params = createparams(filename, options?.fallback);
	return format({ value: "attachment", attributes: params || {} });
}

/**
 * Format attribute header with value and attributes. This is the format used by
 * headers like Content-Disposition: <value>; <attribute>=<value>; ...
 *
 * This uses RFC 5987 formatting, where headers with unicode characters are sent
 * in special fields like `filename*=UTF-8''encoded-filename`, with a fallback
 * at `filename=ascii-filename` for clients who don't support it the new format.
 *
 * @param options.value - Header value (e.g., 'attachment', 'inline')
 * @param options.attributes - an object of key/value pairs e.g. { filename: 'example.txt' }
 * @param options.fallbacks - control fallback values for each attribute, pass `false` to disable the default behaviour of automatically generating a fallback by stripping unicode characters
 *
 * @example
 * formatAttributeHeader({
 *   value: 'attachment',
 *   attributes: { filename: 'example.txt' },
 * }); // -> "attachment; filename=example.txt"
 * formatAttributeHeader({
 *   value: 'attachment',
 *   attributes: { filename: '❤️.txt' },
 *   fallback: { filename: 'love.txt' },
 * }); // -> "attachment; filename*=UTF-8''%F0%9F%92%96.txt; filename=love.txt"
 * formatAttributeHeader({
 *   value: 'attachment',
 *   attributes: { filename: '❤️.txt' },
 *   fallback: false, // or { filename: false }
 * }); // -> "attachment; filename*=UTF-8''%F0%9F%92%96.txt"
 */
export function formatAttributeHeader(options: {
	value: string;
	attributes?: Record<string, string | number>;
	fallbacks?: Record<string, string | boolean> | boolean;
}): string {
	const { value, attributes = {}, fallbacks = {} } = options;
	const params = buildAttributesWithFallbacks(attributes, fallbacks);
	return format({ value, attributes: params });
}

/**
 * Format Content-Disposition header.
 *
 * @param {object} options
 * @param {string} options.filename - Filename for the attachment
 * @param {string | boolean} [options.fallback=true] - Fallback handling
 * @param {string} [options.type='attachment'] - Disposition type
 * @return {string}
 * @public
 */
export function formatContentDispositionHeader(options: {
	filename: string;
	fallback?: string | boolean;
	type?: string;
}): string {
	const { filename, fallback = true, type = "attachment" } = options;
	return formatAttributeHeader({
		value: type,
		attributes: { filename },
		fallbacks: { filename: fallback },
	});
}

/**
 * Parse attribute header string.
 *
 * @param {string} string
 * @return {HeaderValueWithAttributes}
 * @public
 */
export function parseAttributeHeader(string: string): HeaderValueWithAttributes {
	if (!string || typeof string !== "string") {
		throw new TypeError("argument string is required");
	}

	const match = DISPOSITION_TYPE_REGEXP.exec(string);

	if (!match) {
		throw new TypeError("invalid type format");
	}

	// normalise type
	let index = match[0].length;
	const headerValue = match[1].toLowerCase();

	let key: string;
	const names: string[] = [];
	const attributes: Record<string, string> = {};
	let value: string;

	// calculate index to start at
	index = PARAM_REGEXP.lastIndex = match[0].slice(-1) === ";" ? index - 1 : index;

	// match parameters
	let paramMatch: RegExpExecArray | null;
	while ((paramMatch = PARAM_REGEXP.exec(string))) {
		if (paramMatch.index !== index) {
			throw new TypeError("invalid parameter format");
		}

		index += paramMatch[0].length;
		key = paramMatch[1].toLowerCase();
		value = paramMatch[2];

		if (names.indexOf(key) !== -1) {
			throw new TypeError("invalid duplicate parameter");
		}

		names.push(key);

		if (key.indexOf("*") + 1 === key.length) {
			// decode extended value
			key = key.slice(0, -1);
			value = decodefield(value);

			// overwrite existing value
			attributes[key] = value;
			continue;
		}

		if (typeof attributes[key] === "string") {
			continue;
		}

		if (value[0] === '"') {
			// remove quotes and escapes
			value = value.slice(1, -1).replace(QESC_REGEXP, "$1");
		}

		attributes[key] = value;
	}

	if (index !== -1 && index !== string.length) {
		throw new TypeError("invalid parameter format");
	}

	return { value: headerValue, attributes };
}

//
// IMPLEMENTATION
//
// This part of the file imported from content-disposition package
// Original Copyright(c) 2014-2017 Douglas Christopher Wilson
// MIT Licensed
//
// It has been modified from the original
//

// RegExp to match non attr-char, *after* encodeURIComponent (i.e. not including "%")
const ENCODE_URL_ATTR_CHAR_REGEXP = /[\x00-\x20"'()*,/:;<=>?@[\\\]{}\x7f]/g;

// RegExp to match percent encoding escape.
const HEX_ESCAPE_REGEXP = /%[0-9A-Fa-f]{2}/;
const HEX_ESCAPE_REPLACE_REGEXP = /%([0-9A-Fa-f]{2})/g;

// RegExp to match quoted-pair in RFC 2616
//
// quoted-pair = "\" CHAR
// CHAR        = <any US-ASCII character (octets 0 - 127)>
const QESC_REGEXP = /\\([\u0000-\u007f])/g;

// RegExp to match chars that must be quoted-pair in RFC 2616
const QUOTE_REGEXP = /([\\"])/g;

// RegExp for various RFC 2616 grammar
//
// parameter     = token "=" ( token | quoted-string )
// token         = 1*<any CHAR except CTLs or separators>
// separators    = "(" | ")" | "<" | ">" | "@"
//               | "," | ";" | ":" | "\" | <">
//               | "/" | "[" | "]" | "?" | "="
//               | "{" | "}" | SP | HT
// quoted-string = ( <"> *(qdtext | quoted-pair ) <"> )
// qdtext        = <any TEXT except <">>
// quoted-pair   = "\" CHAR
// CHAR          = <any US-ASCII character (octets 0 - 127)>
// TEXT          = <any OCTET except CTLs, but including LWS>
// LWS           = [CRLF] 1*( SP | HT )
// CRLF          = CR LF
// CR            = <US-ASCII CR, carriage return (13)>
// LF            = <US-ASCII LF, linefeed (10)>
// SP            = <US-ASCII SP, space (32)>
// HT            = <US-ASCII HT, horizontal-tab (9)>
// CTL           = <any US-ASCII control character (octets 0 - 31) and DEL (127)>
// OCTET         = <any 8-bit sequence of data>
const PARAM_REGEXP =
	/;[\x09\x20]*([!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*=[\x09\x20]*("(?:[\x20!\x23-\x5b\x5d-\x7e\x80-\xff]|\\[\x20-\x7e])*"|[!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*/g;
const TEXT_REGEXP = /^[\x20-\x7e\x80-\xff]+$/;
const TOKEN_REGEXP = /^[!#$%&'*+.0-9A-Z^_`a-z|~-]+$/;

// RegExp for various RFC 5987 grammar
//
// ext-value     = charset  "'" [ language ] "'" value-chars
// charset       = "UTF-8" / "ISO-8859-1" / mime-charset
// mime-charset  = 1*mime-charsetc
// mime-charsetc = ALPHA / DIGIT
//               / "!" / "#" / "$" / "%" / "&"
//               / "+" / "-" / "^" / "_" / "`"
//               / "{" / "}" / "~"
// language      = ( 2*3ALPHA [ extlang ] )
//               / 4ALPHA
//               / 5*8ALPHA
// extlang       = *3( "-" 3ALPHA )
// value-chars   = *( pct-encoded / attr-char )
// pct-encoded   = "%" HEXDIG HEXDIG
// attr-char     = ALPHA / DIGIT
//               / "!" / "#" / "$" / "&" / "+" / "-" / "."
//               / "^" / "_" / "`" / "|" / "~"
const EXT_VALUE_REGEXP =
	/^([A-Za-z0-9!#$%&+\-^_`{}~]+)'(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}|[A-Za-z]{4,8}|)'((?:%[0-9A-Fa-f]{2}|[A-Za-z0-9!#$&+.^_`|~-])+)$/;

// RegExp for various RFC 6266 grammar
//
// disposition-type = "inline" | "attachment" | disp-ext-type
// disp-ext-type    = token
// disposition-parm = filename-parm | disp-ext-parm
// filename-parm    = "filename" "=" value
//                  | "filename*" "=" ext-value
// disp-ext-parm    = token "=" value
//                  | ext-token "=" ext-value
// ext-token        = <the characters in token, followed by "*">
const DISPOSITION_TYPE_REGEXP = /^([!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*(?:$|;)/;

// Build attributes with fallbacks for multiple parameters.
function buildAttributesWithFallbacks(
	attributes: Record<string, string | number>,
	fallbacks: Record<string, string | boolean> | boolean = {},
): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, rawValue] of Object.entries(attributes)) {
		const value = String(rawValue);
		const fallback =
			typeof fallbacks === "boolean"
				? fallbacks
				: fallbacks[key] !== undefined
					? fallbacks[key]
					: true;

		// Special handling for filename attribute
		if (key === "filename") {
			const fileParams = createFilenameParams(value, fallback);
			Object.assign(result, fileParams);
			continue;
		}

		// Generic attribute handling
		if (typeof fallback !== "string" && typeof fallback !== "boolean") {
			throw new TypeError(`fallback for ${key} must be a string or boolean`);
		}

		if (typeof fallback === "string" && NON_LATIN1_REGEXP.test(fallback)) {
			throw new TypeError(`fallback for ${key} must be ISO-8859-1 string`);
		}

		// Determine if value is suitable for quoted string
		const isQuotedString = TEXT_REGEXP.test(value);

		// Generate fallback value
		const fallbackValue =
			typeof fallback !== "string" ? (fallback ? getlatin1(value) : false) : fallback;
		const hasFallback = typeof fallbackValue === "string" && fallbackValue !== value;

		// Set extended parameter if needed
		if (hasFallback || !isQuotedString || HEX_ESCAPE_REGEXP.test(value)) {
			result[key + "*"] = value;
		}

		// Set regular parameter
		if (isQuotedString || hasFallback) {
			result[key] = hasFallback ? fallbackValue : value;
		}
	}

	return result;
}

// Create parameters object from filename and fallback.
function createFilenameParams(
	filename: string,
	fallback: string | boolean,
): Record<string, string> {
	const params: Record<string, string> = {};

	if (typeof filename !== "string") {
		throw new TypeError("filename must be a string");
	}

	if (typeof fallback !== "string" && typeof fallback !== "boolean") {
		throw new TypeError("fallback must be a string or boolean");
	}

	if (typeof fallback === "string" && NON_LATIN1_REGEXP.test(fallback)) {
		throw new TypeError("fallback must be ISO-8859-1 string");
	}

	// restrict to file base name
	const name = basename(filename);

	// determine if name is suitable for quoted string
	const isQuotedString = TEXT_REGEXP.test(name);

	// generate fallback name
	const fallbackName =
		typeof fallback !== "string" ? (fallback ? getlatin1(name) : false) : basename(fallback);
	const hasFallback = typeof fallbackName === "string" && fallbackName !== name;

	// set extended filename parameter
	if (hasFallback || !isQuotedString || HEX_ESCAPE_REGEXP.test(name)) {
		params["filename*"] = name;
	}

	// set filename parameter
	if (isQuotedString || hasFallback) {
		params.filename = hasFallback ? fallbackName : name;
	}

	return params;
}

// Create parameters object from filename and fallback (legacy wrapper).
function createparams(
	filename: string | undefined,
	fallback: string | boolean | undefined,
): Record<string, string> | undefined {
	if (filename === undefined) {
		return;
	}

	// fallback defaults to true
	if (fallback === undefined) {
		fallback = true;
	}

	return createFilenameParams(filename, fallback);
}

// Format object to header string.
function format(obj: HeaderValueWithAttributes): string {
	const attributes = obj.attributes;
	const headerValue = obj.value;

	if (!headerValue || typeof headerValue !== "string" || !TOKEN_REGEXP.test(headerValue)) {
		throw new TypeError("invalid type");
	}

	// start with normalized type
	let string = String(headerValue).toLowerCase();

	// append parameters
	if (attributes && typeof attributes === "object") {
		const params = Object.keys(attributes).sort();

		for (let i = 0; i < params.length; i++) {
			const param = params[i];
			const attribute = attributes[param];
			if (attribute != null) {
				const val = param.slice(-1) === "*" ? ustring(attribute) : qstring(attribute);
				string += "; " + param + "=" + val;
			}
		}
	}

	return string;
}

// Decode a RFC 5987 field value (gracefully).
function decodefield(str: string): string {
	const match = EXT_VALUE_REGEXP.exec(str);

	if (!match) {
		throw new TypeError("invalid extended field value");
	}

	const charset = match[1].toLowerCase();
	const encoded = match[2];
	let value: string;

	// to binary string
	const binary = encoded.replace(HEX_ESCAPE_REPLACE_REGEXP, pdecode);

	switch (charset) {
		case "iso-8859-1":
			// For parsing, decode as Latin-1 and sanitize control characters (0x00-0x1F, 0x7F-0x9F)
			// but do NOT transliterate (ä stays as ä, not ae)
			value = binary.replace(/[\x00-\x1f\x7f-\x9f]/g, "?");
			break;
		case "utf-8":
		case "utf8":
			value = Buffer.from(binary, "binary").toString("utf8").normalize("NFC");
			break;
		default:
			throw new TypeError("unsupported charset in extended field");
	}

	return value;
}

// Get ISO-8859-1 version of string.
//
// Applies transliteration and mark removal for better fallbacks (café→café not caf?),
// then replaces any remaining non-Latin1 characters with "?".
function getlatin1(val: string): string {
	// transliterate now includes withoutMarks with allowLatin1 option
	let result = transliterate(val, { allowLatin1: true });
	result = withoutComplexChars(result, { target: "latin1", replacement: "?" });
	return result;
}

// Percent decode a single character.
function pdecode(_str: string, hex: string): string {
	return String.fromCharCode(parseInt(hex, 16));
}

// Percent encode a single character.
function pencode(char: string): string {
	return "%" + String(char).charCodeAt(0).toString(16).toUpperCase();
}

// Quote a string for HTTP.
function qstring(val: string): string {
	const str = String(val);

	return '"' + str.replace(QUOTE_REGEXP, "\\$1") + '"';
}

// Encode a Unicode string for HTTP (RFC 5987).
function ustring(val: string): string {
	const str = String(val);

	// percent encode as UTF-8
	const encoded = encodeURIComponent(str).replace(ENCODE_URL_ATTR_CHAR_REGEXP, pencode);

	return "UTF-8''" + encoded;
}

function basename(path: string): string {
	return path.replace(/.*[\\/]/, "");
}
