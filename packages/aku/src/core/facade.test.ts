import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { ApplicationImpl } from "./ApplicationImpl.ts";
import { createFacade, setFacadeApplication } from "./facade.ts";

// Mock service for testing
class MockService {
	value: string;
	callCount = 0;

	constructor(value = "default") {
		this.value = value;
	}

	getValue(): string {
		this.callCount++;
		return this.value;
	}

	setValue(value: string): void {
		this.value = value;
	}
}

describe(createFacade, () => {
	let app: ApplicationImpl;

	beforeEach(() => {
		app = new ApplicationImpl();
		app.bootstrap();
		setFacadeApplication(app);
	});

	afterEach(() => {
		setFacadeApplication(null);
	});

	test("facade returns same instance for singleton binding", () => {
		app.container.bind(MockService, {
			factory: () => new MockService("singleton"),
			lifecycle: "singleton",
		});

		const facade = createFacade(MockService);

		expect(facade.callCount).toBe(0);
		facade.getValue();
		expect(facade.callCount).toBe(1);
		facade.getValue();
		expect(facade.callCount).toBe(2); // Same instance, so count increments
	});

	test("facade returns same instance within scope for scoped binding", async () => {
		app.container.bind(MockService, {
			factory: () => new MockService(),
			lifecycle: "scoped",
		});

		const facade = createFacade(MockService);

		await app.container.withScope(async () => {
			expect(facade.callCount).toBe(0);
			facade.getValue();
			expect(facade.callCount).toBe(1);
			facade.getValue();
			expect(facade.callCount).toBe(2); // Same instance, so count increments
		});
	});

	test("facade returns different instance in new scope for scoped binding", async () => {
		let instanceCount = 0;
		app.container.bind(MockService, {
			factory: () => new MockService(`scoped-${++instanceCount}`),
			lifecycle: "scoped",
		});

		const facade = createFacade(MockService);

		app.withIntegration({} as IntegrationContext, () => {
			expect(facade.value).toBe("scoped-1");
		});

		app.withIntegration({} as IntegrationContext, () => {
			expect(facade.value).toBe("scoped-2");
		});
	});

	test("facade throws error for transient binding", () => {
		app.container.bind(MockService, {
			factory: () => new MockService("transient"),
			lifecycle: "transient",
		});

		const facade = createFacade(MockService);

		expect(() => facade.value).toThrow("Facades only support singleton and scoped bindings");
	});

	test("facade created when global application is null does not fail", () => {
		app.container.bind(MockService, {
			factory: () => new MockService("now available"),
			lifecycle: "singleton",
		});

		setFacadeApplication(null);

		// Creating the facade should not throw
		const facade = createFacade(MockService);

		expect(() => facade.value).toThrow(
			"Global application instance is not available. Ensure createApplication() has been called.",
		);

		setFacadeApplication(app);
		expect(facade.value).toBe("now available");
	});

	test("facade handles 'in' operator correctly", () => {
		app.container.bind(MockService, {
			factory: () => new MockService("test"),
			lifecycle: "singleton",
		});

		const facade = createFacade(MockService);

		expect("value" in facade).toBe(true);
		expect("getValue" in facade).toBe(true);
		expect("nonExistent" in facade).toBe(false);
	});

	test("facade handles Object.keys correctly", () => {
		app.container.bind(MockService, {
			factory: () => new MockService("test"),
			lifecycle: "singleton",
		});

		const facade = createFacade(MockService);
		const keys = Object.keys(facade);

		expect(keys).toContain("value");
		expect(keys).toContain("callCount");
	});

	test("facade handles Object.getOwnPropertyDescriptor correctly", () => {
		app.container.bind(MockService, {
			factory: () => new MockService("test"),
			lifecycle: "singleton",
		});

		const facade = createFacade(MockService);
		const descriptor = Object.getOwnPropertyDescriptor(facade, "value");

		expect(descriptor).toBeDefined();
		expect(descriptor?.value).toBe("test");
		expect(descriptor?.writable).toBe(true);
	});
});
