import { webcrypto as crypto } from "node:crypto";
import { mockable } from "../../testing/mocks.ts";

function toHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("hex");
}

const DEFAULT_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const POOL_SIZE = 2048;
let pool: Uint8Array<ArrayBuffer> | undefined;
let poolOffset = 0;

/**
 * Generate a random string with a given length
 *
 * @param length The length of the string to generate.
 * @param alphabet A string containing characters to use. Defaults to letters, numbers, underscore and hyphen.
 */
export const random: (length: number, alphabet?: string) => string = mockable(function random(
	length,
	alphabet = DEFAULT_ALPHABET,
): string {
	if (!length) return "";

	// Hat-tip nanoid for this line below
	// First, a bitmask is necessary to generate the ID. The bitmask makes bytes
	// values closer to the alphabet size. The bitmask calculates the closest
	// `2^31 - 1` number, which exceeds the alphabet size.
	// For example, the bitmask for the alphabet size 30 is 31 (00011111).
	const mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1;

	if (!pool) {
		pool = new Uint8Array(new ArrayBuffer(POOL_SIZE));
		crypto.getRandomValues(pool);
	}
	let id = "";
	while (id.length < length) {
		if (poolOffset >= POOL_SIZE) {
			crypto.getRandomValues(pool);
			poolOffset = 0;
		}
		const byte = pool[poolOffset++];
		id += alphabet[byte & mask] ?? "";
	}
	return id;
});

/**
 * Generate an ID using URL-safe characters (letters, numbers, underscore and
 * dash). The default length is 22 which gives comparable entropy to a UUID
 */
export const randomId: (length?: number) => string = mockable(function randomId(
	length = 22,
): string {
	return random(length);
});

/**
 * Generate a random hex string with the given length
 */
export const randomHex: (length: number) => string = mockable(function randomHex(
	length: number,
): string {
	return random(length, "0123456789abcdef");
});

interface PasswordOptions {
	length?: number;
	letters?: boolean;
	numbers?: boolean;
	symbols?: boolean;
	spaces?: boolean;
}

/**
 * Generate a random, secure password
 *
 * @param options - Password generation options
 * @returns Random password
 *
 * @example
 * password() // 'aB3$xY9!mK2#pL8@qR5%nS7'
 * password({ length: 16, letters: true, numbers: true, symbols: false })
 */
export const password: (options?: PasswordOptions) => string = mockable(function password(
	options: PasswordOptions = {},
): string {
	const { length = 32, letters = true, numbers = true, symbols = true, spaces = false } = options;

	const charSets: string[] = [];

	if (letters) {
		charSets.push("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
	}
	if (numbers) {
		charSets.push("0123456789");
	}
	if (symbols) {
		charSets.push("~!#$%^&*()-_.,<>?/\\{}[]|:;");
	}
	if (spaces) {
		charSets.push(" ");
	}

	if (charSets.length === 0) {
		throw new Error("At least one character type must be enabled");
	}

	// Ensure at least one character from each enabled set
	let password = "";
	for (const charSet of charSets) {
		if (password.length < length) {
			password += random(1, charSet);
		}
	}

	// Fill remaining length with random characters from all sets
	const remaining = length - password.length;

	if (remaining > 0) {
		const allChars = charSets.join("");
		password += random(remaining, allChars);
	}

	return password;
});

// Crockford Base32 alphabet (no I, L, O, U to avoid confusion)
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_TIME_LENGTH = 10;
const ULID_RANDOM_LENGTH = 16;
const ULID_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier)
 *
 * @param time - Optional timestamp (default: now)
 * @returns ULID string (26 characters)
 *
 * @example
 * ulid() // '01ARZ3NDEKTSV4RRFFQ69G5FAV'
 * ulid(new Date('2024-01-01')) // '01HN3...'
 */
export const ulid: (time?: Date | number) => string = mockable(function ulid(
	time: Date | number = Date.now(),
): string {
	if (time instanceof Date) {
		time = time.getTime();
	}

	// Encode timestamp (48 bits) as 10 characters
	let timeStr = "";
	let t = time;
	for (let i = ULID_TIME_LENGTH - 1; i >= 0; i--) {
		const mod = t % 32;
		timeStr = ULID_ALPHABET[mod] + timeStr;
		t = Math.floor(t / 32);
	}

	const randomStr = random(ULID_RANDOM_LENGTH, ULID_ALPHABET);

	return timeStr + randomStr;
});

/**
 * Validate if a string is a valid ULID
 *
 * @param value - String to validate
 * @returns True if valid ULID
 *
 * @example
 * isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV') // true
 * isUlid('not-a-ulid') // false
 */
export function isUlid(value: string): boolean {
	return ULID_REGEX.test(value);
}

/**
 * Generate a UUID v4 (random)
 *
 * @returns UUID v4 string
 *
 * @example
 * uuidV4() // '550e8400-e29b-41d4-a716-446655440000'
 */
export const uuidV4: () => string = mockable(function uuidV4(): string {
	return crypto.randomUUID();
});

/**
 * Generate a UUID v7, which includes a timestamp and a random component.
 *
 * The time-ordered component ensures that uuids sort in the order that they
 * were created, making them useful for database keys where a default ordering
 * by creation time is desirable.
 *
 * @param time - Optional timestamp (default: now)
 * @returns UUID v7 string
 *
 * @example
 * uuid() // '018e5e0d-7a7d-7890-b123-456789abcdef'
 */
export const uuid: (time?: Date | number) => string = mockable(function uuid(
	time?: Date | number,
): string {
	const timestamp = time instanceof Date ? time.getTime() : (time ?? Date.now());

	// UUID v7 format: unix_ts_ms (48 bits) + version (4 bits) + rand_a (12 bits) + variant (2 bits) + random (62 bits)
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	// Set timestamp (48 bits = 6 bytes)
	const timestampMs = BigInt(timestamp);
	bytes[0] = Number((timestampMs >> 40n) & 0xffn);
	bytes[1] = Number((timestampMs >> 32n) & 0xffn);
	bytes[2] = Number((timestampMs >> 24n) & 0xffn);
	bytes[3] = Number((timestampMs >> 16n) & 0xffn);
	bytes[4] = Number((timestampMs >> 8n) & 0xffn);
	bytes[5] = Number(timestampMs & 0xffn);

	// Set version (4 bits) to 7
	bytes[6] = (bytes[6]! & 0x0f) | 0x70;

	// Set variant (2 bits) to RFC 4122
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;

	return (
		toHex(bytes.slice(0, 4)) +
		"-" +
		toHex(bytes.slice(4, 6)) +
		"-" +
		toHex(bytes.slice(6, 8)) +
		"-" +
		toHex(bytes.slice(8, 10)) +
		"-" +
		toHex(bytes.slice(10))
	);
});

/**
 * Validate if a string is a valid UUID
 *
 * @param value - String to validate
 * @param version - Optional UUID version to validate (1-8, or null for any)
 * @returns True if valid UUID
 *
 * @example
 * isUuid('550e8400-e29b-41d4-a716-446655440000') // true
 * isUuid('550e8400-e29b-41d4-a716-446655440000', 4) // true
 * isUuid('not-a-uuid') // false
 */
export function isUuid(
	value: unknown,
	version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null,
): value is string {
	if (typeof value !== "string") return false;

	const uuidRegex = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
	if (!uuidRegex.test(value)) return false;

	if (version != null) {
		const versionChar = value.charAt(14);
		return versionChar === version.toString();
	}

	return true;
}
