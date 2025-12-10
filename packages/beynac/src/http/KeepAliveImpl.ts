import { inject } from "../container/inject.ts";
import { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { BaseClass } from "../utils.ts";
import type { KeepAlive } from "./contracts/KeepAlive.ts";

export class KeepAliveImpl extends BaseClass implements KeepAlive {
	#integrationContext: IntegrationContext;

	constructor(integrationContext: IntegrationContext = inject(IntegrationContext)) {
		super();
		this.#integrationContext = integrationContext;
	}

	waitUntil(task: Promise<void>): void {
		const addKeepAliveTask = this.#integrationContext.addKeepAliveTask;
		if (!addKeepAliveTask) {
			throw new Error(
				`Cannot add keep-alive task in context "${this.#integrationContext.context}": keep-alive tasks are not supported`,
			);
		}
		addKeepAliveTask(task);
	}
}
