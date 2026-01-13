import { mockable } from "../../../../testing/mocks.ts";

// Good: mockable function with matching name
export const goodMockable: unknown = mockable(function goodMockable(): string {
	return "good";
});

// Bad: mockable function with mismatched internal name
export const exportedName: unknown = mockable(function wrongName(): string {
	return "bad";
});
