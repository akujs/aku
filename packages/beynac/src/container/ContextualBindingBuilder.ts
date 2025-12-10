import { BaseClass } from "../utils.ts";
import type { FactoryFunction } from "./ContainerImpl.ts";
import type { KeyOrClass } from "./container-key.ts";
import type { Container } from "./contracts/Container.ts";

type AddCallback = (need: KeyOrClass, factory: FactoryFunction<unknown>) => void;

export class ContextualBindingBuilder extends BaseClass {
	#container: Container;
	#add: AddCallback;

	constructor(container: Container, add: AddCallback) {
		super();
		this.#container = container;
		this.#add = add;
	}

	needs<T>(need: KeyOrClass<T>): ContextualBindingBuilderFinal<T> {
		return new ContextualBindingBuilderFinal(this.#container, this.#add, need);
	}
}

class ContextualBindingBuilderFinal<T> extends BaseClass {
	#container: Container;
	#add: AddCallback;
	#need: KeyOrClass;

	constructor(container: Container, add: AddCallback, need: KeyOrClass) {
		super();
		this.#container = container;
		this.#add = add;
		this.#need = need;
	}

	give(key: KeyOrClass<T>): void {
		this.#add(this.#need, (() => this.#container.get(key)) as FactoryFunction<unknown>);
	}

	create(factory: FactoryFunction<T>): void {
		this.#add(this.#need, factory as FactoryFunction<unknown>);
	}
}
