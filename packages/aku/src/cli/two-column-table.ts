import { stripVTControlCharacters, styleText } from "node:util";
import wrapAnsi from "wrap-ansi";

type TwoColumnTableOptions = {
	rows: Array<[string, string]>;
	width: number;
	leftColor?: Parameters<typeof styleText>[0] | undefined;
	indent?: string | undefined;
};

export function twoColumnTable(options: TwoColumnTableOptions): string {
	const { rows, width, leftColor, indent = "" } = options;

	if (rows.length === 0) {
		return "";
	}

	const gap = "  ";
	const maxLeftWidth = Math.floor((width - indent.length - gap.length) / 2);

	// Process left column: strip control chars, truncate, measure
	const processedRows = rows.map(([left, right]) => {
		const stripped = stripVTControlCharacters(left);
		const truncated = truncateWithEllipsis(stripped, maxLeftWidth);
		return { left: truncated, right };
	});

	// Calculate the actual max width needed for the left column
	const leftColumnWidth = Math.max(...processedRows.map((row) => row.left.length));

	// Build output
	const lines: string[] = [];

	for (const { left, right } of processedRows) {
		const paddedLeft = left.padEnd(leftColumnWidth);
		const styledLeft = leftColor ? styleText(leftColor, paddedLeft) : paddedLeft;

		const rightColumnWidth = width - indent.length - leftColumnWidth - gap.length;
		const wrappedRight = wrapAnsi(right, rightColumnWidth, { hard: true });
		const rightLines = wrappedRight.split("\n");

		// First line: indent + styled left + gap + first part of right
		lines.push(`${indent}${styledLeft}${gap}${rightLines[0]}`);

		// Continuation lines: indent + padding + gap + rest of right
		const continuationIndent = indent + " ".repeat(leftColumnWidth) + gap;
		for (let i = 1; i < rightLines.length; i++) {
			lines.push(`${continuationIndent}${rightLines[i]}`);
		}
	}

	return lines.join("\n") + "\n";
}

function truncateWithEllipsis(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	if (maxLength <= 3) {
		return text.slice(0, maxLength);
	}
	return text.slice(0, maxLength - 3) + "...";
}
