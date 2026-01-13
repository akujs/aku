import { sha256 } from "../helpers/hash/digest.ts";
import { random } from "../helpers/str/random.ts";
import { regExpEscape } from "../utils.ts";
import { posix } from "./path-operations.ts";

// MIME type and file name handling for storage operations. Based on Chrome's
const mappings: Array<[string, string[]]> = [
	// Chrome secondary mime mappings
	["video/webm", [".webm"]],
	["audio/mpeg", [".mp3"]],
	["video/mp4", [".mp4", ".m4v"]],
	["audio/mp4", [".m4a"]],
	["audio/x-m4a", [".m4a"]],
	["video/ogg", [".ogv", ".ogm"]],
	["audio/ogg", [".ogg", ".oga", ".opus"]],
	["audio/x-vorbis+ogg", [".ogg"]],
	["video/x-ogm+ogg", [".ogm"]],
	["audio/flac", [".flac"]],
	["audio/wav", [".wav"]],
	["audio/x-wav", [".wav"]],
	["application/ogg", [".ogx"]],
	["application/pdf", [".pdf"]],
	["application/xml", [".xml"]],
	["image/gif", [".gif"]],
	["image/jpeg", [".jpeg", ".jpg"]],
	["image/png", [".png"]],
	["image/apng", [".png"]],
	["image/webp", [".webp"]],
	["text/plain", [".txt"]],
	["video/mpeg", [".mpeg", ".mpg"]],
	["video/quicktime", [".mov", ".qt"]],
	["video/x-flv", [".flv"]],
	["image/avif", [".avif"]],
	["image/svg+xml", [".svg", ".svgz"]],
	["image/bmp", [".bmp"]],
	["video/3gpp", [".3gp", ".3gpp", ".3ga", ".3gpp2", ".3g2"]],

	// Chrome secondary mime mappings
	["image/x-icon", [".ico"]],
	["image/x-xbitmap", [".xbm"]],
	["image/vnd.microsoft.icon", [".ico"]],
	["video/x-msvideo", [".avi"]],
	["audio/x-pn-wav", [".wav"]],
	["text/html", [".html", ".htm", ".shtml", ".shtm"]],
	["application/xhtml+xml", [".xhtml", ".xht", ".xhtm"]],
	["image/tiff", [".tif", ".tiff"]],
	["audio/mpeg3", [".mp3"]],
	["audio/x-mpeg-3", [".mp3"]],
	["audio/basic", [".au", ".snd"]],
	["audio/x-aiff", [".aif", ".aiff", ".aifc"]],
	["audio/aiff", [".aif", ".aiff", ".aifc"]],
	["image/x-ms-bmp", [".bmp"]],
	["application/x-shockwave-flash", [".swf", ".swl"]],
	["application/pkcs7-mime", [".p7m", ".p7c", ".p7z"]],
	["application/pkcs7-signature", [".p7s"]],
	["text/css", [".css"]],
	["text/xml", [".xml"]],
	["text/javascript", [".js", ".mjs"]],
	["application/javascript", [".js", ".mjs"]],
	["application/ecmascript", [".js", ".mjs"]],
	["text/ecmascript", [".js", ".mjs"]],
	["application/json", [".json"]],
	["application/x-x509-ca-cert", [".cer", ".crt"]],
	["application/x-x509-user-cert", [".crt"]],
	["application/pkix-cert", [".cer", ".crt"]],
	["application/x-pem-file", [".pem"]],
	["application/x-pkcs12", [".p12", ".pfx"]],
	["application/zip", [".zip"]],
	["application/x-gzip", [".gz", ".tgz"]],
	["application/gzip", [".gz", ".tgz"]],
	["application/msword", [".doc", ".dot"]],
	["application/vnd.ms-excel", [".xls", ".xlm", ".xla", ".xlc", ".xlt", ".xlw"]],
	["application/vnd.ms-powerpoint", [".ppt", ".pps", ".pot"]],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [".xlsx"]],
	["application/vnd.openxmlformats-officedocument.presentationml.presentation", [".pptx"]],
	["application/postscript", [".ps", ".eps", ".ai"]],
	["application/rtf", [".rtf"]],
	["text/csv", [".csv"]],
	["text/calendar", [".ics"]],
	["image/x-png", [".png"]],
	["font/woff", [".woff"]],
	["font/woff2", [".woff2"]],
	["application/font-woff", [".woff"]],
	["application/font-woff2", [".woff2"]],
	["application/wasm", [".wasm"]],
];

let mimeToExtensions: Map<string, string[]> | undefined;

const getExtensionForMime = (mime: string | null | undefined): string | undefined => {
	if (!mime) return undefined;
	mimeToExtensions ??= new Map(mappings);
	return mimeToExtensions.get(mime)?.[0];
};

let extensionToMime: Map<string, string> | undefined;

const getMimeForExtension = (extension: string): string | undefined => {
	if (!extensionToMime) {
		extensionToMime = new Map<string, string>();
		for (const [mime, exts] of mappings) {
			for (const ext of exts) {
				if (!/\.\w+$/.test(ext)) {
					throw new Error(`Invalid extension: ${ext}`);
				}
				if (!extensionToMime.has(ext)) {
					extensionToMime.set(ext, mime);
				}
			}
		}
	}
	return extensionToMime.get(extension);
};

export function mimeTypeFromFileName(nameOrPath: string): string | null {
	const extension = posix.extname(nameOrPath.toLowerCase());
	return getMimeForExtension(extension) ?? null;
}

export function createFileName(
	suggestedName: string | null | undefined,
	mimeType: string | null,
	supportsMimeTypes: boolean,
): string {
	let usedRandomId = false;
	let name = posix.basename(suggestedName?.trim() ?? "");
	if (!name) {
		// Use all caps so that they're unique on case-insensitive filesystems
		name = random(20, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
		usedRandomId = true;
	}

	const cleanMimeType = mimeType?.split(";")[0].trim().toLowerCase();

	if (!supportsMimeTypes || usedRandomId) {
		const expectedExtension = getExtensionForMime(cleanMimeType);
		if (expectedExtension) {
			const extension = posix.extname(name).toLowerCase();

			if (extension) {
				const currentMime = getMimeForExtension(extension);

				if (currentMime !== cleanMimeType) {
					name = name + expectedExtension;
				}
			} else {
				name = name + expectedExtension;
			}
		}
	}

	return name;
}

export function sanitiseName(name: string, invalidChars: string): string {
	const regex = new RegExp(`[${regExpEscape(invalidChars)}]+`, "g");

	if (!regex.test(name)) {
		return name;
	}

	const replacement = invalidChars.includes("_") ? "" : "_";
	const sanitised = name.replace(regex, replacement);

	const hash = sha256(name);
	const hashSuffix = `-${hash.slice(0, 8)}`;

	const extension = posix.extname(sanitised);
	if (extension) {
		const nameWithoutExt = sanitised.slice(0, -extension.length);
		return nameWithoutExt + hashSuffix + extension;
	}

	return sanitised + hashSuffix;
}

export function joinSlashPaths(a: string, b: string): string {
	if (!a) return b;
	if (!b) return a;

	const aClean = a.endsWith("/") ? a.slice(0, -1) : a;
	const bClean = b.startsWith("/") ? b.slice(1) : b;

	return `${aClean}/${bClean}`;
}
