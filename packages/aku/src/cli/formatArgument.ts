import { kebabCase } from "../helpers/str/case.ts";
import type { ArgumentDefinition } from "./cli-types.ts";

export function formatUsageToken(name: string, def: ArgumentDefinition): string | null {
	const effectivelyRequired = isEffectivelyRequired(def);

	if (def.positional) {
		if (def.array) {
			return effectivelyRequired ? `<${name}> [${name}...]` : `[${name}...]`;
		}
		return effectivelyRequired ? `<${name}>` : `[${name}]`;
	}

	// Named args: only required ones get their own usage token
	if (!effectivelyRequired) return null;

	const cliName = kebabCase(name);
	if (def.type === "boolean") {
		return `--${cliName}`;
	}
	return `--${cliName}=<value>`;
}

export function formatArgumentDetail(
	name: string,
	def: ArgumentDefinition,
): { label: string; description: string } {
	const effectivelyRequired = isEffectivelyRequired(def);

	let label: string;
	if (def.positional) {
		label = effectivelyRequired ? `<${name}>` : `[${name}]`;
	} else {
		const cliName = kebabCase(name);
		label = def.type === "boolean" ? `--${cliName}` : `--${cliName}=<value>`;
	}

	const metadata = buildMetadata(def, effectivelyRequired);
	const parts: string[] = [];
	if (def.description) {
		parts.push(def.description);
	}
	if (metadata) {
		parts.push(`(${metadata})`);
	}

	return { label, description: parts.join(" ") };
}

function isEffectivelyRequired(def: ArgumentDefinition): boolean {
	return def.required === true && def.default === undefined;
}

function buildMetadata(def: ArgumentDefinition, effectivelyRequired: boolean): string {
	const parts: string[] = [];

	if (def.type === "number") {
		parts.push("number");
	}

	parts.push(effectivelyRequired ? "required" : "optional");

	if (def.default !== undefined) {
		if (Array.isArray(def.default)) {
			const formatted = (def.default as readonly (string | number)[])
				.map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
				.join(", ");
			parts.push(`default: ${formatted}`);
		} else {
			const v = def.default;
			parts.push(`default: ${typeof v === "string" ? `"${v}"` : String(v)}`);
		}
	}

	if (def.array) {
		parts.push("repeatable");
	}

	return parts.join(", ");
}
