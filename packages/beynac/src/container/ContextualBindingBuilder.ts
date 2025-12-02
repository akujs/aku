import { BaseClass } from "../utils.ts";
import type { FactoryFunction } from "./ContainerImpl.ts";
import type { KeyOrClass } from "./container-key.ts";
import type { Container } from "./contracts/Container.ts";

type AddCallback = (need: KeyOrClass, factory: FactoryFunction<unknown>) => void;

export class ContextualBindingBuilder extends BaseClass {
	constructor(
		private container: Container,
		private add: AddCallback,
	) {
		super();
	}

	needs<T>(need: KeyOrClass<T>): ContextualBindingBuilderFinal<T> {
		return new ContextualBindingBuilderFinal(this.container, this.add, need);
	}
}

class ContextualBindingBuilderFinal<T> extends BaseClass {
	constructor(
		private container: Container,
		private add: AddCallback,
		private need: KeyOrClass,
	) {
		super();
	}

	give(key: KeyOrClass<T>): void {
		this.add(this.need, (() => this.container.get(key)) as FactoryFunction<unknown>);
	}

	create(factory: FactoryFunction<T>): void {
		this.add(this.need, factory as FactoryFunction<unknown>);
	}
}
