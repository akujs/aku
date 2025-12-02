// No-unit CSS properties based on React's implementation

import type { CSSProperties } from "./view-types.ts";

// Source: https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/shared/isUnitlessNumber.js
const noUnitProperties = new Set([
	"animationIterationCount",
	"aspectRatio",
	"borderImageOutset",
	"borderImageSlice",
	"borderImageWidth",
	"boxFlex",
	"boxFlexGroup",
	"boxOrdinalGroup",
	"columnCount",
	"columns",
	"flex",
	"flexGrow",
	"flexPositive",
	"flexShrink",
	"flexNegative",
	"flexOrder",
	"gridArea",
	"gridRow",
	"gridRowEnd",
	"gridRowSpan",
	"gridRowStart",
	"gridColumn",
	"gridColumnEnd",
	"gridColumnSpan",
	"gridColumnStart",
	"fontWeight",
	"lineClamp",
	"lineHeight",
	"opacity",
	"order",
	"orphans",
	"scale",
	"tabSize",
	"widows",
	"zIndex",
	"zoom",
	"fillOpacity", // SVG-related properties
	"floodOpacity",
	"stopOpacity",
	"strokeDasharray",
	"strokeDashoffset",
	"strokeMiterlimit",
	"strokeOpacity",
	"strokeWidth",
	"MozAnimationIterationCount", // Known Prefixed Properties
	"MozBoxFlex", // TODO: Remove these since they shouldn't be used in modern code
	"MozBoxFlexGroup",
	"MozLineClamp",
	"msAnimationIterationCount",
	"msFlex",
	"msZoom",
	"msFlexGrow",
	"msFlexNegative",
	"msFlexOrder",
	"msFlexPositive",
	"msFlexShrink",
	"msGridColumn",
	"msGridColumnSpan",
	"msGridRow",
	"msGridRowSpan",
	"WebkitAnimationIterationCount",
	"WebkitBoxFlex",
	"WebKitBoxFlexGroup",
	"WebkitBoxOrdinalGroup",
	"WebkitColumnCount",
	"WebkitColumns",
	"WebkitFlex",
	"WebkitFlexGrow",
	"WebkitFlexPositive",
	"WebkitFlexShrink",
	"WebkitLineClamp",
]);

export const styleObjectToString = (style: CSSProperties): string => {
	let result = "";
	for (const [k, v] of Object.entries(style)) {
		if (v == null) continue;

		// Special case: if property starts with "ms" and third letter is capital (e.g., "msFlex"),
		// capitalize the "m" to make it "MsFlex" so it renders as "-ms-flex"
		let propName = k;
		if (k.length >= 3 && k.startsWith("ms") && /[A-Z]/.test(k[2])) {
			propName = "Ms" + k.substring(2);
		}

		// Convert camelCase to kebab-case, except for CSS variables (starting with --)
		const key =
			propName[0] === "-" || !/[A-Z]/.test(propName)
				? propName // CSS variable or already kebab-case
				: propName.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`); // Convert camelCase to kebab-case

		// Convert numbers to px for properties that need units
		// Check the original property name (k) not the transformed one (propName)
		const value = typeof v === "number" ? (noUnitProperties.has(k) ? `${v}` : `${v}px`) : String(v);

		if (result) result += ";";
		result += `${key}:${value}`;
	}
	return result;
};
