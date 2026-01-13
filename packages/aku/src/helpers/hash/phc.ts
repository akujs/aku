/**
 * PHC string format fields
 */
export interface PHCFields {
	/** Algorithm identifier (e.g., "scrypt", "argon2i") */
	id: string;
	/** Algorithm version (optional) */
	version?: number | undefined;
	/** Algorithm parameters as key-value pairs */
	params: Record<string, number | string | undefined>;
	/** Salt bytes */
	salt?: Buffer | undefined;
	/** Hash output bytes */
	hash?: Buffer | undefined;
}

/**
 * Format PHC string from fields
 * Format: $id[$v=version]$params[$salt][$hash]
 */
export function formatPhc(fields: PHCFields): string {
	let result = `$${fields.id}`;

	if (fields.version !== undefined) {
		result += `$v=${fields.version}`;
	}

	const params = Object.entries(fields.params)
		.filter((v) => v[1] != null)
		.map(([k, v]) => `${k}=${v}`)
		.join(",");
	result += `$${params}`;

	if (fields.salt !== undefined) {
		const saltB64 = fields.salt.toString("base64").replace(/=+$/, "");
		result += `$${saltB64}`;
	}

	if (fields.hash !== undefined) {
		const hashB64 = fields.hash.toString("base64").replace(/=+$/, "");
		result += `$${hashB64}`;
	}

	return result;
}

/**
 * Parse PHC string into fields.
 *
 * @example
 * parsePhc("$argon2id$v=19$m=65536,t=2,p=1$U2FsdGVkX19zZG9uZw==$U2FsdGVkX19zZG9uZw==");
 * // produces:
 *  {
 *    id: "argon2id",
 *    version: 19,
 *    params: { m: 65536, t: 2, p: 1 },
 *    salt: (Buffer),
 *    hash: (Buffer)
 *  }
 */
export function parsePhc(phcString: string): PHCFields {
	const parts = phcString.split("$");
	if (parts.length < 3 || parts[0] !== "") {
		throw new Error("Invalid PHC format");
	}

	let idx = 1;
	const id = parts[idx++];

	let version: number | undefined;
	if (parts[idx]?.startsWith("v=")) {
		version = Number.parseInt(parts[idx].substring(2), 10);
		idx++;
	}

	const paramsStr = parts[idx++];
	const params: Record<string, number | string> = {};
	for (const param of paramsStr.split(",")) {
		const [key, value] = param.split("=");
		// Try to parse as number, fall back to string
		const numValue = Number.parseInt(value, 10);
		params[key] = Number.isNaN(numValue) ? value : numValue;
	}

	// Optional salt (empty string "" is valid for empty salt)
	const salt =
		idx < parts.length && parts[idx] != null ? Buffer.from(parts[idx++], "base64") : undefined;

	// Optional hash (empty string "" is valid for empty hash)
	const hash =
		idx < parts.length && parts[idx] != null ? Buffer.from(parts[idx++], "base64") : undefined;

	return { id, version, params, salt, hash };
}
