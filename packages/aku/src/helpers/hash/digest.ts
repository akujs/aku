import { createHash } from "node:crypto";
import { mockable } from "../../testing/mocks.ts";

type HashEncoding = "hex" | "base64";

type DigestHashFunction = (data: string | Uint8Array, encoding?: HashEncoding) => string;

/**
 * Hash data using SHA-256
 */
export const hashSha256: DigestHashFunction = digestImpl("sha256", "hashSha256");

/**
 * Hash data using SHA-512
 */
export const hashSha512: DigestHashFunction = digestImpl("sha512", "hashSha512");

/**
 * Hash data using SHA3-256
 */
export const hashSha3_256: DigestHashFunction = digestImpl("sha3-256", "hashSha3_256");

/**
 * Hash data using SHA3-512
 */
export const hashSha3_512: DigestHashFunction = digestImpl("sha3-512", "hashSha3_512");

/**
 * Hash data using MD5
 */
export const hashMd5: DigestHashFunction = digestImpl("md5", "hashMd5");

function digestImpl(algorithm: string, name: string) {
	return mockable(function (data: string | Uint8Array, encoding: HashEncoding = "hex"): string {
		const hash = createHash(algorithm);
		hash.update(data);
		return hash.digest(encoding);
	}, name);
}
