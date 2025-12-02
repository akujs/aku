import { mockable } from "../../../../testing/mocks.ts";

// Good: mockable function with matching name
export const goodMockable = mockable(function goodMockable() {
	return "good";
});

// Bad: mockable function with mismatched internal name
export const exportedName = mockable(function wrongName() {
	return "bad";
});
