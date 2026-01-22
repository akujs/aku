export interface DefinitionListItem {
	label: string;
	definition: string;
}

export interface TerminalUi {
	paragraph(text: string): void;
	title(text: string): void;
	subtitle(text: string): void;
	definitionList(items: DefinitionListItem[]): void;
	fatalError(error: unknown): void;
	readonly exitCode: number;
}
