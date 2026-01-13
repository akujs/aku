/**
 * An interface that shares a name with a Key constant.
 * This is a common TypeScript pattern used for dependency injection.
 */
export interface SharedName {
	doSomething(): void;
}

// we don't document this, but that should be OK because the type is documented
export const SharedName: string = "SharedName";
