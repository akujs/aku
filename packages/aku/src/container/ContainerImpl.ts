import { AsyncLocalStorage } from "node:async_hooks";
import { AkuError } from "../core/core-errors.ts";
import {
	type AnyConstructor,
	ArrayMultiMap,
	arrayWrap,
	BaseClass,
	getPrototypeChain,
	type NoArgConstructor,
	SetMultiMap,
} from "../utils.ts";
import { ContextualBindingBuilder } from "./ContextualBindingBuilder.ts";
import { getKeyName, type KeyOrClass, type TypeToken } from "./container-key.ts";
import type { Lifecycle } from "./contracts/Container.ts";
import { Container } from "./contracts/Container.ts";
import { _getInjectHandler, _setInjectHandler } from "./inject.ts";
import { NO_VALUE, type NoValue } from "./no-value.ts";

type ScopeContext = {
	container: Container;
	instances: Map<KeyOrClass, unknown>;
};

const scopeContext = new AsyncLocalStorage<ScopeContext>();

export type FactoryFunction<T> = (container: Container) => {
	[K in keyof T]: T[K];
};

type ContextualOverrides = Map<KeyOrClass, FactoryFunction<unknown>>;

type AnyFactory = (container: Container) => unknown;

type CommonBindingProperties = {
	contextualOverrides?: ContextualOverrides;
	extenders?: ExtenderCallback[];
	reverseAliases?: Set<KeyOrClass>;
	resolvingCallbacks?: InstanceCallback<unknown>[];
};

type ConcreteBinding = {
	kind: "concrete";
	type: KeyOrClass;
	class?: AnyConstructor;
	factory?: AnyFactory;
	lifecycle: Lifecycle;
	instance?: unknown;
	resolved?: boolean;
} & CommonBindingProperties;

type AliasBinding = {
	kind: "alias";
	type: KeyOrClass;
	to: KeyOrClass;
} & CommonBindingProperties;

type ImplicitBinding = {
	kind: "implicit";
	type: KeyOrClass;
	resolved?: boolean;
} & CommonBindingProperties;

type Binding = ConcreteBinding | AliasBinding | ImplicitBinding;

type BindArgsWithFactory<T> = {
	class?: AnyConstructor<T>;
	factory?: FactoryFunction<T>;
	instance?: T;
	lifecycle?: Lifecycle;
	ifNotBound?: boolean;
};

type BindArgsWithoutFactory<T> = {
	class: NoArgConstructor<T>;
	factory?: never;
	instance?: never;
	lifecycle?: Lifecycle;
	ifNotBound?: boolean;
};

type ExtenderCallback<T = unknown> = (instance: T, container: Container) => T;

type InstanceCallback<T> = (instance: T, container: Container) => void;

/**
 * The primary implementation of {@link Container}. Most applications use the
 * application container instance at `app.container`, but if your application
 * needs an isolated container instance for its own purposes it can use this
 * implementation.
 */
export class ContainerImpl extends BaseClass implements Container {
	#bindings = new Map<KeyOrClass, Binding>();
	#buildStack: Set<KeyOrClass> = new Set();
	#tags = new SetMultiMap<KeyOrClass, KeyOrClass>();

	#reboundCallbacks = new ArrayMultiMap<KeyOrClass, InstanceCallback<unknown>>();

	#resolvingCallbacks = new ArrayMultiMap<KeyOrClass, InstanceCallback<unknown>>();

	constructor() {
		super();
		this.singletonInstance(Container, this);
	}

	static currentlyInScope(): Container | null {
		return scopeContext.getStore()?.container ?? null;
	}

	bind<T>(
		type: KeyOrClass<T>,
		implOrOptions?: NoArgConstructor<T> | BindArgsWithFactory<T> | BindArgsWithoutFactory<T>,
	): void {
		// Handle the bind(type, impl) overload
		if (typeof implOrOptions === "function") {
			this.bind(type, { class: implOrOptions });
			return;
		}
		// Handle the bind(impl) overload - only for classes
		if (typeof implOrOptions === "undefined" && typeof type === "function") {
			this.bind(type, { class: type as NoArgConstructor });
			return;
		}

		const options = implOrOptions ?? {};
		let { class: cls, factory, instance, lifecycle, ifNotBound } = options;

		const previousBinding = this.#bindings.get(type);

		if (ifNotBound && previousBinding) {
			return;
		}

		// Normally we consider null to be a valid kind of instance. You can bind a
		// nullable type with the value null in the container. However, if people
		// have provided a factory function, let us assume that it is an accidental
		// null, and they meant undefined rather than null. Otherwise they'd get a
		// weird error saying "you can't provide both an instance and a factory" and
		// they'll be all "mate I haven't provided an instance".
		if ((factory || cls) && instance === null) {
			instance = undefined;
		}

		if (factory && instance !== undefined) {
			throw this.#containerError(
				`Error binding ${getKeyName(type)}: Cannot provide both factory and instance`,
			);
		}

		if (cls && instance !== undefined) {
			throw this.#containerError(
				`Error binding ${getKeyName(type)}: Cannot provide both class and instance`,
			);
		}

		if (!cls && !factory && !instance) {
			throw this.#containerError(
				`Error binding ${getKeyName(type)}: Must provide class, factory, or instance`,
			);
		}

		// Instance validation
		lifecycle ??= instance !== undefined ? "singleton" : "transient";

		if (instance !== undefined) {
			if (lifecycle === "transient") {
				throw this.#containerError(
					`Error binding ${getKeyName(type)}: an instance can not be provided for transient bindings.`,
				);
			}
			// Apply any extenders that were registered before the instance
			instance = this.#applyExtenders(type, instance);

			// If scoped, store the instance in the current scope only
			if (lifecycle === "scoped") {
				const scopeInstances = scopeContext.getStore()?.instances;
				if (!scopeInstances) {
					throw this.#containerError(
						`Error binding ${getKeyName(type)}: scoped instances can only be bound while handling a request.`,
					);
				}
				scopeInstances.set(type, instance);
				// Don't store in binding.instance for scoped - it belongs to the scope only
				instance = undefined;
			}
		}

		this.#bindings.set(type, {
			kind: "concrete",
			type: type,
			class: cls as AnyConstructor,
			factory: factory as FactoryFunction<unknown>,
			lifecycle,
			instance,
			...getPropertiesThatSurviveRebinding(previousBinding),
		});

		if (previousBinding) {
			this.#rebound(type);
		}
	}

	bindIf<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "transient", true);
	}

	singleton<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "singleton");
	}

	singletonIf<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "singleton", true);
	}

	scoped<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "scoped");
	}

	scopedIf<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "scoped", true);
	}

	#bindWithLifecycle<T>(
		typeOrImpl: KeyOrClass<T>,
		impl: NoArgConstructor<T> | undefined,
		lifecycle: Lifecycle,
		ifNotBound = false,
	): void {
		if (impl === undefined) {
			this.bind(typeOrImpl as NoArgConstructor<T>, {
				class: typeOrImpl as NoArgConstructor<T>,
				lifecycle,
				ifNotBound,
			});
		} else {
			this.bind(typeOrImpl, { class: impl, lifecycle, ifNotBound });
		}
	}

	singletonInstance<T>(type: KeyOrClass<T>, instance: T): void {
		this.bind(type, { instance });
	}

	singletonInstanceIf<T>(type: KeyOrClass<T>, instance: T): void {
		this.bind(type, { instance, ifNotBound: true });
	}

	scopedInstance<T>(type: KeyOrClass<T>, instance: T): void {
		this.bind(type, { instance, lifecycle: "scoped" });
	}

	scopedInstanceIf<T>(type: KeyOrClass<T>, instance: T): void {
		this.bind(type, { instance, ifNotBound: true, lifecycle: "scoped" });
	}

	bound(type: KeyOrClass): boolean {
		return this.#getActualBinding(type).kind !== "implicit";
	}

	get<T>(type: KeyOrClass<T>): T {
		const result = this.#get<T>(type);
		if (result instanceof ContainerError) {
			throw result;
		}
		return result;
	}

	getIfAvailable<T>(type: KeyOrClass<T>): T | undefined {
		const result = this.#get<T>(type);
		if (result instanceof ContainerError) {
			return undefined;
		}
		return result;
	}

	#get<T>(type: KeyOrClass<T>): T | ContainerError {
		const binding = this.#getConcreteBinding(type);
		type = binding.type as KeyOrClass<T>;

		if (this.#buildStack.has(type)) {
			return this.#containerError(
				`Circular dependency detected: ${formatKeyCycle(this.#buildStack, type)}`,
			);
		}

		this.#buildStack.add(type);
		const previousInjectHandler = _getInjectHandler();
		try {
			const needsContextualBuild = this.#hasContextualOverrides(binding);
			_setInjectHandler(<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
				return this.#getInjected(type, dependency, optional);
			});

			let factory: AnyFactory | undefined;

			let scopeInstances: Map<KeyOrClass, unknown> | undefined;

			if (binding.kind === "concrete") {
				// Check if this is a scoped binding
				if (binding.lifecycle === "scoped") {
					scopeInstances = scopeContext.getStore()?.instances;
					if (!scopeInstances) {
						return this.#containerError(
							`Cannot create ${getKeyName(type)} because it is scoped so can only be accessed within a request`,
							{ omitTopOfBuildStack: true },
						);
					}

					if (scopeInstances.has(type)) {
						const instance = scopeInstances.get(type) as T;
						this.#fireResolvingCallbacks(type, instance);
						return instance;
					}
				} else if (binding?.instance !== undefined && !needsContextualBuild) {
					const instance = binding.instance as T;
					this.#fireResolvingCallbacks(type, instance);
					return instance;
				}
				factory = binding.factory;

				// If no factory but we have a stored class, create factory from the class
				if (!factory && binding.class) {
					factory = () => new (binding.class as new () => T)();
				}
			}

			if (!factory && typeof type === "function") {
				// allow implicitly bound keys to be resolved if they're class references
				if (!isDefaultBindingAllowed(type)) {
					return this.#containerError(
						`${getKeyName(type)} has not been bound to the container. ` +
							`Implicit binding is disabled via ${whitelistDefaultBindingsForInternalTests.name}().`,
						{ omitTopOfBuildStack: true },
					);
				}
				// Runtime check: ensure no required constructor arguments
				if (type.length > 0) {
					return this.#containerError(
						`Can't create an instance of ${getKeyName(type)} because it looks like it has required constructor arguments. Either bind it to the container, or ensure that all arguments have default values e.g. constructor(arg = "default")`,
						{ omitTopOfBuildStack: true },
					);
				}
				factory = () => new (type as new () => T)();
			}

			if (!factory) {
				const name = getKeyName(type);
				return this.#containerError(
					`Can't create an instance of ${name} because no value or factory function was supplied`,
					{ omitTopOfBuildStack: true },
				);
			}

			let instance = factory(this) as T;

			instance = this.#applyExtenders(type, instance);

			if (binding.kind === "concrete") {
				// Store instance appropriately based on binding type
				if (scopeInstances) {
					scopeInstances.set(type, instance);
				} else if (binding?.lifecycle === "singleton" && !needsContextualBuild) {
					binding.instance = instance;
				}
				binding.resolved = true;
			} else if (binding.kind === "implicit") {
				binding.resolved = true;
			}

			this.#fireResolvingCallbacks(type, instance);

			return instance;
		} finally {
			this.#buildStack.delete(type);
			_setInjectHandler(previousInjectHandler);
		}
	}

	#hasContextualOverrides(binding: Binding): boolean {
		if (binding.contextualOverrides) return true;

		for (const aliasTo of this.#getAllAliasesTo(binding)) {
			if (aliasTo.contextualOverrides) return true;
		}

		return false;
	}

	#getAllAliasesTo(binding: Binding): Set<AliasBinding> {
		const aliases = new Set<AliasBinding>();
		const add = (b: Binding) => {
			if (b.reverseAliases) {
				for (const fromKey of b.reverseAliases) {
					const fromBinding = this.#bindings.get(fromKey);
					if (fromBinding && fromBinding.kind === "alias") {
						if (!aliases.has(fromBinding)) {
							aliases.add(fromBinding);
							add(fromBinding);
						}
					}
				}
			}
		};
		add(binding);
		return aliases;
	}

	#getContextualOverride(
		context: KeyOrClass,
		dependency: KeyOrClass,
	): FactoryFunction<unknown> | null {
		const ctxBinding = this.#getConcreteBinding(context);
		const depBinding = this.#getConcreteBinding(dependency);

		if (!ctxBinding.contextualOverrides) return null;

		const getOverride = (cb: Binding, db: Binding) => cb.contextualOverrides?.get(db.type);

		// direct overrides - this exact context needs this exact dependency
		const override = getOverride(ctxBinding, depBinding);
		if (override) {
			// the dependency has been directly overridden
			return override;
		}

		// overrides on an alias to the dependency
		for (const depAlias of this.#getAllAliasesTo(depBinding)) {
			const override = getOverride(ctxBinding, depAlias);
			if (override) {
				return override;
			}
		}

		// overrides on an alias to the context
		for (const ctxAlias of this.#getAllAliasesTo(ctxBinding)) {
			const override = getOverride(ctxAlias, depBinding);
			if (override) {
				return override;
			}
		}

		// Check stored class in dependency binding
		if (depBinding.kind === "concrete" && depBinding.class) {
			const classBinding = this.#getActualBinding(depBinding.class);
			const directClassMatch = getOverride(ctxBinding, classBinding);
			if (directClassMatch) {
				return directClassMatch;
			}

			// Also check aliases to the stored class
			for (const classAlias of this.#getAllAliasesTo(classBinding)) {
				const aliasMatch = getOverride(ctxBinding, classAlias);
				if (aliasMatch) {
					return aliasMatch;
				}
			}
		}

		return null;
	}

	#getInjected<T>(
		context: KeyOrClass | undefined,
		dependency: KeyOrClass<T>,
		optional: boolean,
	): T | NoValue {
		if (context) {
			// if we're calling a method on an object, we need to check for
			// contextual overrides for the class of the object
			const override = this.#getContextualOverride(context, dependency);
			if (override != null) {
				let instance = override(this) as T;
				instance = this.#applyExtenders(dependency, instance);
				this.#fireResolvingCallbacks(dependency, instance);
				return instance;
			}
		}
		if (optional && !this.bound(dependency)) {
			return NO_VALUE;
		}
		return this.get(dependency);
	}

	#getConcreteBinding<T>(type: KeyOrClass<T>): ConcreteBinding | ImplicitBinding {
		const stack = new Set<KeyOrClass>();
		let binding = this.#getActualBinding(type);
		while (binding?.kind === "alias") {
			if (stack.has(type)) {
				throw this.#containerError(`Circular alias detected: ${formatKeyCycle(stack, type)}`);
			}
			stack.add(type);
			type = binding.to as KeyOrClass<T>;
			binding = this.#getActualBinding(type);
		}
		return binding;
	}

	#getActualBinding<T>(type: KeyOrClass<T>): Binding {
		let binding = this.#bindings.get(type);
		if (!binding) {
			binding = {
				kind: "implicit",
				type: type,
			};
			this.#bindings.set(type, binding);
		}
		return binding;
	}

	alias<T>({ to, from }: { to: KeyOrClass<T>; from: KeyOrClass<T> }): void {
		if (to === from) {
			throw this.#containerError(`${getKeyName(from)} is aliased to itself.`);
		}

		const existingFrom = this.#bindings.get(from);
		if (existingFrom?.kind === "alias") {
			const existingTo = this.#bindings.get(existingFrom.to);
			if (existingTo) {
				existingTo.reverseAliases?.delete(from);
			}
		}

		const newBinding: AliasBinding = {
			kind: "alias",
			type: from,
			to,
			...getPropertiesThatSurviveRebinding(existingFrom),
		};
		this.#bindings.set(from, newBinding);

		const toBinding = this.#getActualBinding(to);
		toBinding.reverseAliases ??= new Set();
		toBinding.reverseAliases.add(from);
	}

	resolved(type: KeyOrClass): boolean {
		const binding = this.#getConcreteBinding(type);
		return !!(binding.resolved || (binding.kind === "concrete" && binding.instance !== undefined));
	}

	getLifecycle(type: KeyOrClass): Lifecycle {
		const binding = this.#getConcreteBinding(type);
		return binding.kind === "concrete" ? binding.lifecycle : "transient";
	}

	withScope<T>(callback: () => T): T {
		const context: ScopeContext = {
			container: this,
			instances: new Map<KeyOrClass, unknown>(),
		};
		return scopeContext.run(context, callback);
	}

	get hasScope(): boolean {
		return scopeContext.getStore() !== undefined;
	}

	extend<T>(type: KeyOrClass<T>, callback: ExtenderCallback<T>): void {
		const binding = this.#getConcreteBinding(type);
		binding.extenders ??= [];
		binding.extenders.push(callback as ExtenderCallback);

		// If there's already a shared instance, apply the extender immediately
		if (binding.kind === "concrete" && binding.instance !== undefined) {
			binding.instance = callback(binding.instance as T, this);
			this.#rebound(type);
		} else if (binding.kind === "concrete" && binding.lifecycle === "scoped") {
			// For scoped instances, apply to the instance in the current scope if it exists
			const scopeInstances = scopeContext.getStore()?.instances;
			if (scopeInstances?.has(type)) {
				const instance = scopeInstances.get(type) as T;
				const extended = callback(instance, this);
				scopeInstances.set(type, extended);
				this.#rebound(type);
			}
		} else if (this.resolved(type)) {
			this.#rebound(type);
		}
	}

	/**
	 * Apply all registered extenders for a given type to an instance
	 */
	#applyExtenders<T>(type: KeyOrClass<T>, instance: T): T {
		const keyBinding = this.#getConcreteBinding(type);
		const applied = new Set<Binding>();

		const applyOnce = (b: Binding) => {
			if (b.extenders && !applied.has(b)) {
				applied.add(b);
				for (const extender of b.extenders) {
					instance = extender(instance, this) as T;
				}
			}
		};

		applyOnce(keyBinding);

		for (const alias of this.#getAllAliasesTo(keyBinding)) {
			applyOnce(alias);
		}

		return instance;
	}

	/**
	 * Fire the "rebound" callbacks for the given type
	 */
	#rebound<T>(type: KeyOrClass<T>): void {
		const callbacks = Array.from(this.#reboundCallbacks.get(type));
		if (callbacks.length) {
			const instance = this.get(type);
			for (const callback of callbacks) {
				callback(instance, this);
			}
		}
	}

	when(consumer: KeyOrClass | KeyOrClass[]): ContextualBindingBuilder {
		return new ContextualBindingBuilder(this, (need, factory) => {
			for (const type of arrayWrap(consumer)) {
				const binding = this.#bindings.get(type) ?? this.#getConcreteBinding(type);
				binding.contextualOverrides ??= new Map();
				binding.contextualOverrides.set(need, factory);
			}
		});
	}

	#containerError(message: string, args: { omitTopOfBuildStack?: boolean } = {}): ContainerError {
		const stackArray = Array.from(this.#buildStack);
		return new ContainerError(message, {
			buildStack: args.omitTopOfBuildStack ? stackArray.slice(0, -1) : stackArray,
		});
	}

	onRebinding<T>(type: KeyOrClass<T>, callback: InstanceCallback<T>): this {
		this.#reboundCallbacks.add(type, callback as InstanceCallback<unknown>);
		return this;
	}

	currentlyResolving(): KeyOrClass | null {
		return Array.from(this.#buildStack).at(-1) ?? null;
	}

	onResolving<T>(type: KeyOrClass<T>, callback: InstanceCallback<T>): this {
		this.#resolvingCallbacks.add(type, callback as InstanceCallback<unknown>);
		return this;
	}

	#fireResolvingCallbacks(type: KeyOrClass, instance: unknown): void {
		const fireForType = (type: KeyOrClass) => {
			const callbacks = this.#resolvingCallbacks.get(type);
			if (callbacks) {
				for (const callback of callbacks) {
					callback(instance, this);
				}
			}
		};

		fireForType(type);

		if (instance == null) return;

		for (const constructor of getPrototypeChain(instance)) {
			if (constructor !== type) {
				fireForType(constructor);
			}
		}
	}

	withInject<R>(closure: () => R): R {
		return this.#contextualInject(undefined, closure);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	invoke<T extends object, K extends keyof T>(
		object: T,
		methodName: K,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...params: T[K] extends (...args: any) => any ? Parameters<T[K]> : never[]
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): T[K] extends (...args: any) => any ? ReturnType<T[K]> : never {
		const consumer = (Object.getPrototypeOf(object) as object).constructor as KeyOrClass;

		return this.#contextualInject(consumer, () => {
			const o = object as Record<string, (...args: unknown[]) => unknown>;
			const m = methodName as string;
			if (!o[m]) {
				throw new Error(`Method ${m} not found on object`);
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return o[m](...params) as T[K] extends (...args: any) => any ? ReturnType<T[K]> : never;
		});
	}

	construct<P extends unknown[], T>(impl: { new (...args: P): T }, ...args: P): T {
		return this.#contextualInject(impl, () => new impl(...args));
	}

	#contextualInject<R>(consumer: KeyOrClass | undefined, closure: () => R): R {
		const previousInjectHandler = _getInjectHandler();
		try {
			_setInjectHandler(<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
				return this.#getInjected(consumer, dependency, optional) as TArg;
			});
			return closure();
		} finally {
			_setInjectHandler(previousInjectHandler);
		}
	}

	tag<T>(keys: KeyOrClass<T> | KeyOrClass<T>[], tags: TypeToken<T> | TypeToken<T>[]): void {
		this.#tags.addAll(tags, keys);
	}

	*tagged<T>(tags: TypeToken<T> | TypeToken<T>[]): Generator<T, void, void> {
		for (const tag of arrayWrap(tags)) {
			for (const type of this.#tags.get(tag)) {
				yield this.get(type) as T;
			}
		}
	}
}

const formatKeyCycle = (stack: Set<KeyOrClass>, cycleKey: KeyOrClass) => {
	const stackArray = Array.from(stack);
	const cycleStart = stackArray.indexOf(cycleKey);
	return stackArray.slice(cycleStart).concat(cycleKey).map(getKeyName).join(" -> ");
};

class ContainerError extends AkuError {
	constructor(message: string, args: { buildStack: KeyOrClass[] | null }) {
		if (args.buildStack && args.buildStack.length > 0) {
			message += ` (while building ${args.buildStack.map(getKeyName).join(" -> ")})`;
		}
		super(message);
		this.name = "ContainerError";
	}
}

const getPropertiesThatSurviveRebinding = (
	binding: Binding | undefined,
): CommonBindingProperties => {
	const common: CommonBindingProperties = {};
	if (binding) {
		if (binding.contextualOverrides !== undefined) {
			common.contextualOverrides = binding.contextualOverrides;
		}
		if (binding.extenders !== undefined) {
			common.extenders = binding.extenders;
		}
		if (binding.reverseAliases !== undefined) {
			common.reverseAliases = binding.reverseAliases;
		}
		if (binding.resolvingCallbacks !== undefined) {
			common.resolvingCallbacks = binding.resolvingCallbacks;
		}
		if (binding.kind === "concrete" && binding.resolved) {
			(common as ConcreteBinding).resolved = binding.resolved;
		}
	}
	return common;
};

let defaultBindingWhitelist: AnyConstructor[] | null = null;

// Used internally to make it harder for us to forget to add a binding for services
export function whitelistDefaultBindingsForInternalTests(...classes: AnyConstructor[]): void {
	defaultBindingWhitelist ??= [];
	defaultBindingWhitelist.push(...classes);
}

export function allowDefaultBindings(): void {
	defaultBindingWhitelist = null;
}

function isDefaultBindingAllowed(type: AnyConstructor): boolean {
	return (
		defaultBindingWhitelist === null ||
		defaultBindingWhitelist.some((cls) => type === cls || type.prototype instanceof cls)
	);
}
