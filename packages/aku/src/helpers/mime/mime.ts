// MIME type lookup functions. Based on Chrome's built-in MIME type mappings.
const mappings: Array<[string, string[]]> = [
	// Chrome primary mime mappings
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
let extensionToMime: Map<string, string> | undefined;

const ensureExtensionToMime = (): Map<string, string> => {
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
	return extensionToMime;
};

/**
 * Get the MIME type for a file extension or filename (e.g. ".pdf", "pdf", "document.pdf").
 * Case insensitive. Returns null if unknown.
 */
export function mimeGetTypeForExtension(extensionOrFilename: string): string | null {
	const lower = extensionOrFilename.toLowerCase();
	const dotIndex = lower.lastIndexOf(".");
	const ext = dotIndex >= 0 ? lower.slice(dotIndex) : `.${lower}`;
	return ensureExtensionToMime().get(ext) ?? null;
}

/**
 * Get the canonical file extension for a MIME type (e.g. "application/pdf" -> ".pdf").
 * Returns null if unknown.
 */
export function mimeGetExtensionForType(mimeType: string): string | null {
	mimeToExtensions ??= new Map(mappings);
	return mimeToExtensions.get(mimeType)?.[0] ?? null;
}
