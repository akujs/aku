import type { AnyFunction, MethodNames, NoArgConstructor } from "../../utils.ts";
import type { ContextualBindingBuilder } from "../ContextualBindingBuilder.ts";
import type { KeyOrClass, TypeToken } from "../container-key.ts";
import { createTypeToken } from "../container-key.ts";

export type FactoryFunction<T> = (container: Container) => {
	[K in keyof T]: T[K];
};

export type Lifecycle = "transient" | "singleton" | "scoped";

export type BindArgsWithFactory<T> = {
	class?: new (...args: never[]) => T;
	factory?: FactoryFunction<T>;
	instance?: T;
	lifecycle?: Lifecycle;
	ifNotBound?: boolean;
};

export type BindArgsWithoutFactory<T> = {
	class: NoArgConstructor<T>;
	factory?: never;
	instance?: never;
	lifecycle?: Lifecycle;
	ifNotBound?: boolean;
};

export type InstanceCallback<T> = (instance: T, container: Container) => void;

/**
 * A type-safe Inversion of Control (IoC) container. Essentially a fancy map of
 * keys (class objects or type tokens) to values (instances of the types
 * referred to by the class or token).
 *
 * Key features include:
 *
 * - get(MyClass): create an instance of MyClass
 * - bind(MyClass, () => ...): register a method to control how MyClass is constructed
 * - singleton(MyClass): all future calls to get(MyClass) will return the same object
 * - scoped(MyClass): each request gets a separate instance of MyClass
 *
 * See: {@link TODO link to IoC docs}
 */
export interface Container {
	/**
	 * Bind an interface to an implementation in the IoC container.
	 *
	 * The binding must have some way to create a value - either an instance, or a
	 * class constructor with no required arguments, or a factory function.
	 *
	 * @param type a value to look up the binding by - a type token created with
	 *            typeToken, or class object
	 * @param options arguments to control how the value created:
	 * @param options.class a class to instantiate. This will be used for
	 *                      contextual binding. If the class has no required
	 *                      arguments (default arguments e.g. dep =
	 *                      inject(Dependency) are fine), it can also be used to
	 *                      create an instance, otherwise a factory function is
	 *                      required too.
	 * @param options.instance an instance to register as a singleton. When
	 *                         providing an instance, `factory` must not be
	 *                         provided and `lifecycle` will always be
	 *                         "singleton".
	 * @param options.factory a factory function to generate an instance.
	 * @param options.lifecycle the lifecycle of the binding. Available options
	 *                          are:
	 *
	 *                          - `"transient"`: a new instance is created on each call to get()
	 *                          - `"scoped"`: a new instance is created for each request
	 *                          - `"singleton"`: one instance is created for and reused for all requests
	 * @param options.ifNotBound if true, the binding will not be created if it
	 *                           already exists
	 */
	bind<T>(type: KeyOrClass<T>, options: BindArgsWithFactory<T> | BindArgsWithoutFactory<T>): void;

	/**
	 * Bind a class as both type and implementation. Will create a transient binding
	 * - every call to container.get(type) will return a new instance.
	 *
	 * Equivalent to `bind(impl, { class: impl });`
	 *
	 * @example
	 * container.bind(LoggerImpl);
	 * container.get(LoggerImpl); // creates a new instance each time
	 */
	bind<T>(impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to implementation class. Will create a transient binding
	 * - every call to container.get(type) will return a new instance.
	 *
	 * Equivalent to `bind(type, { class: impl });`
	 *
	 * @example
	 * container.bind(ILogger, LoggerImpl);
	 * container.get(ILogger); // creates a new instance each time
	 */
	bind<T>(type: KeyOrClass<T>, impl: NoArgConstructor<T>): void;

	/**
	 * Bind a class as both type and implementation, if the class is not bound already. Will create a
	 * transient binding - every call to container.get(impl) will return a new instance.
	 *
	 * Equivalent to `bind(impl, { class: impl, lifecycle: "transient", ifNotBound: true });`
	 *
	 * @example
	 * container.bindIf(Logger);
	 * container.get(Logger); // creates a new instance each time
	 */
	bindIf<T>(impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to implementation class, if the type is not bound already. Will create a
	 * transient binding - every call to container.get(type) will return a new instance.
	 *
	 * Equivalent to `bind(type, { class: impl, lifecycle: "transient", ifNotBound: true });`
	 *
	 * @example
	 * container.bindIf(ILogger, LoggerImpl);
	 * container.get(ILogger); // creates a new instance each time
	 */
	bindIf<T>(type: KeyOrClass<T>, impl: NoArgConstructor<T>): void;

	/**
	 * Bind a class as both type and implementation. Will create a singleton binding
	 * - the first call to container.get(impl) creates an instance, subsequent
	 * calls return the same instance.
	 *
	 * Equivalent to `bind(impl, { class: impl, lifecycle: "singleton" });`
	 *
	 * @example
	 * container.singleton(Database);
	 * const db1 = container.get(Database);
	 * const db2 = container.get(Database);
	 * // db1 === db2
	 */
	singleton<T>(impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to implementation class as a singleton. Will create a singleton binding
	 * - the first call to container.get(type) creates an instance, subsequent
	 * calls return the same instance.
	 *
	 * Equivalent to `bind(type, { class: impl, lifecycle: "singleton" });`
	 *
	 * @example
	 * container.singleton(IDatabase, DatabaseImpl);
	 * const db1 = container.get(IDatabase);
	 * const db2 = container.get(IDatabase);
	 * // db1 === db2
	 */
	singleton<T>(type: KeyOrClass<T>, impl: NoArgConstructor<T>): void;

	/**
	 * Bind a class as both type and implementation, if the class is not bound already.
	 * Will create a singleton binding - the first call to container.get(impl) creates
	 * an instance, subsequent calls return the same instance.
	 *
	 * Equivalent to `bind(impl, { class: impl, lifecycle: "singleton", ifNotBound: true });`
	 *
	 * @example
	 * container.singletonIf(Database);
	 * const db1 = container.get(Database);
	 * const db2 = container.get(Database);
	 * // db1 === db2
	 */
	singletonIf<T>(impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to implementation class as a singleton, if the type is not bound already.
	 * Will create a singleton binding - the first call to container.get(type) creates
	 * an instance, subsequent calls return the same instance.
	 *
	 * Equivalent to `bind(type, { class: impl, lifecycle: "singleton", ifNotBound: true });`
	 *
	 * @example
	 * container.singletonIf(IDatabase, DatabaseImpl);
	 * const db1 = container.get(IDatabase);
	 * const db2 = container.get(IDatabase);
	 * // db1 === db2
	 */
	singletonIf<T>(type: KeyOrClass<T>, impl: NoArgConstructor<T>): void;

	/**
	 * Bind a class as both type and implementation. Will create a scoped binding
	 * - a new instance is created for each request scope and reused within that scope.
	 *
	 * Equivalent to `bind(impl, { class: impl, lifecycle: "scoped" });`
	 *
	 * @example
	 * container.scoped(RequestLogger);
	 * container.withScope(() => {
	 *   const logger1 = container.get(RequestLogger);
	 *   const logger2 = container.get(RequestLogger);
	 *   // logger1 === logger2 (same scope)
	 * });
	 */
	scoped<T>(impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to implementation class as a scoped binding. Will create a scoped binding
	 * - a new instance is created for each request scope and reused within that scope.
	 *
	 * Equivalent to `bind(type, { class: impl, lifecycle: "scoped" });`
	 *
	 * @example
	 * container.scoped(IRequestLogger, RequestLoggerImpl);
	 * container.withScope(() => {
	 *   const logger1 = container.get(IRequestLogger);
	 *   const logger2 = container.get(IRequestLogger);
	 *   // logger1 === logger2 (same scope)
	 * });
	 */
	scoped<T>(type: KeyOrClass<T>, impl: NoArgConstructor<T>): void;

	/**
	 * Bind a class as both type and implementation, if the class is not bound already.
	 * Will create a scoped binding - a new instance is created for each request scope
	 * and reused within that scope.
	 *
	 * Equivalent to `bind(impl, { class: impl, lifecycle: "scoped", ifNotBound: true });`
	 *
	 * @example
	 * container.scopedIf(RequestLogger);
	 * container.withScope(() => {
	 *   const logger1 = container.get(RequestLogger);
	 *   const logger2 = container.get(RequestLogger);
	 *   // logger1 === logger2 (same scope)
	 * });
	 */
	scopedIf<T>(impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to implementation class as a scoped binding, if the type is not bound already.
	 * Will create a scoped binding - a new instance is created for each request scope
	 * and reused within that scope.
	 *
	 * Equivalent to `bind(type, { class: impl, lifecycle: "scoped", ifNotBound: true });`
	 *
	 * @example
	 * container.scopedIf(IRequestLogger, RequestLoggerImpl);
	 * container.withScope(() => {
	 *   const logger1 = container.get(IRequestLogger);
	 *   const logger2 = container.get(IRequestLogger);
	 *   // logger1 === logger2 (same scope)
	 * });
	 */
	scopedIf<T>(type: KeyOrClass<T>, impl: NoArgConstructor<T>): void;

	/**
	 * Bind a type to a pre-existing instance as a singleton. The instance
	 * will be returned for all calls to container.get(type).
	 *
	 * Equivalent to `bind(type, { instance });`
	 *
	 * @example
	 * const config = new Config({ debug: true });
	 * container.instance(Config, config);
	 * container.get(Config); // returns the same config instance
	 */
	singletonInstance<T>(type: KeyOrClass<T>, instance: T): void;

	/**
	 * Bind a type to a pre-existing instance as a singleton, if the type is
	 * not bound already.
	 * The instance will be returned for all calls to container.get(type).
	 *
	 * Equivalent to `bind(type, { instance, ifNotBound: true });`
	 *
	 * @example
	 * const config = new Config({ debug: true });
	 * container.instanceIf(Config, config);
	 * container.get(Config); // returns the same config instance
	 */
	singletonInstanceIf<T>(type: KeyOrClass<T>, instance: T): void;

	/**
	 * Bind a type to a pre-existing instance with the current request scope.
	 * The instance will be returned for all calls to container.get(type)
	 * while the request is in being handled.
	 *
	 * Equivalent to `bind(type, { instance, lifecycle: "scoped" });`
	 *
	 * @example
	 * const routeData = new RouteData();
	 * container.withScope(() => {
	 *   container.scopedInstance(RouteData, routeData);
	 *   container.get(RouteData); // returns the same routeData instance
	 * });
	 */
	scopedInstance<T>(type: KeyOrClass<T>, instance: T): void;

	/**
	 * Bind a type to a pre-existing instance with the current request scope,
	 * if the type is not already bound. The instance will be returned for
	 * all calls to container.get(type) while the request is in being handled.
	 *
	 * Equivalent to `bind(type, { instance, lifecycle: "scoped", ifNotBound: true });`
	 *
	 * @example
	 * container.withScope(() => {
	 *   const routeData = new RouteData();
	 *   container.scopedInstanceIf(RouteData, routeData);
	 *   container.get(RouteData); // returns the same routeData instance
	 * });
	 */
	scopedInstanceIf<T>(type: KeyOrClass<T>, instance: T): void;

	/**
	 * Determine if a binding exists for the given type.
	 */
	bound(type: KeyOrClass): boolean;

	/**
	 * Get an instance of the given type from the container.
	 */
	get<T>(type: KeyOrClass<T>): T;

	/**
	 * Get an instance of the given type from the container if available,
	 * or null if the dependency is not bound or if it's scoped but no scope is active.
	 *
	 * @returns The instance if available, null otherwise
	 */
	getIfAvailable<T>(type: KeyOrClass<T>): T | undefined;

	/**
	 * Alias a type to a different name. After setting up an alias,
	 * `container.get(from)` will return the same value as `container.get(to)`
	 */
	alias<T>(args: { from: KeyOrClass<T>; to: KeyOrClass<T> }): void;

	/**
	 * Determine if the given type has been resolved.
	 */
	resolved(type: KeyOrClass): boolean;

	/**
	 * Get the lifecycle associated with the given type.
	 */
	getLifecycle(type: KeyOrClass): Lifecycle;

	/**
	 * Execute a callback within a scope. Scoped bindings will return
	 * independent instances within each scope.
	 *
	 * @param callback The async callback to execute within the scope
	 * @returns The result of the callback
	 */
	withScope<T>(callback: () => T): T;

	/**
	 * Check if the container is currently executing within a scope.
	 *
	 * @returns True if currently inside a scope, false otherwise
	 */
	readonly hasScope: boolean;

	/**
	 * "Extend" a type in the container. You can use this to configure or alter
	 * objects created by the container.
	 *
	 * Any singletons or shared instances already created will be extended
	 * immediately.
	 *
	 * @param type The type to extend
	 * @param callback A callback that receives the instance and a reference
	 *                 to the container. It may modify and return the same
	 *                 instance or create another instance of a compatible type.
	 */
	extend<T>(type: KeyOrClass<T>, callback: (instance: T, container: Container) => T): void;

	/**
	 * Register a listener to be called when a type is rebound
	 *
	 * @returns The container instance for chaining
	 */
	onRebinding<T>(type: KeyOrClass<T>, callback: InstanceCallback<T>): this;

	/**
	 * Get the type that the container is currently resolving or null if there is
	 * no type being resolved.
	 */
	currentlyResolving(): KeyOrClass | null;

	/**
	 * Register a callback to be run after a type is resolved.
	 *
	 * The callback will be called when either:
	 *
	 * 1. the type is used in `container.get(type)`
	 * 2. an instance of the type or a subclass is returned from
	 *    container.get()
	 *
	 * Since all values extend `Object` in javascript, you can register a
	 * callback that fires when _any_ value is resolved using
	 * `onResolving(Object, callback)`.
	 *
	 * @returns The container instance for chaining
	 */
	onResolving<T>(type: KeyOrClass<T>, callback: InstanceCallback<T>): this;

	/**
	 * Call a closure in the context of the container, allowing
	 * dependencies to be injected.
	 *
	 * @param closure The closure to call
	 * @returns The return value of the closure
	 */
	withInject<R>(closure: () => R): R;

	/**
	 * Invoke a method on an object in the context of the container, allowing
	 * dependencies to be injected into the method.
	 *
	 * The method may declare injected arguments and contextual bindings can
	 * be used to override the dependencies given to the object.
	 *
	 * @param object The object containing the method
	 * @param methodName The name of the method to call
	 * @param params The parameters to pass to the method
	 * @returns The return value of the method
	 *
	 * @example
	 * class FooCreator {
	 *   createFoo(name: string, helper = inject(Helper)): Foo {
	 *     ...
	 *   }
	 * }
	 * // optionally use contextual bindings to override the dependency
	 * container.when(FooCreator).needs(Helper).give(CustomHelper);
	 * // call a method on a Foo instance
	 * const creator = new FooCreator();
	 * const result = container.invoke(creator, "createFoo", "myFoo");
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	invoke<T extends object, K extends MethodNames<T> & keyof T>(
		object: T,
		methodName: K,
		...params: T[K] extends AnyFunction ? Parameters<T[K]> : never[]
	): T[K] extends AnyFunction ? ReturnType<T[K]> : never;

	/**
	 * Invoke a method on an object, allowing dependencies to be injected into
	 * the method.
	 *
	 * The method may declare injected dependencies and contextual bindings can
	 * be used to override the dependencies given to the object.
	 *
	 * @param object The object containing the method
	 * @param methodName The name of the method to call
	 * @returns The return value of the method
	 *
	 * @example
	 * class Foo {
	 *   constructor(private name: string, private dispatcher = inject(Dispatcher)) {}
	 * }
	 * // optionally use contextual bindings to override the dependency
	 * container.when(Foo).needs(Dispatcher).give(CustomDispatcher);
	 * // create a Foo instance
	 * const foo = container.construct(Foo, "myFoo");
	 */
	construct<P extends unknown[], T>(cls: { new (...args: P): T }, ...args: P): T;

	/**
	 * Assign a set of tags to a given binding.
	 *
	 * @param keys The abstract types
	 * @param tags The tags
	 */
	tag<T>(keys: KeyOrClass<T> | KeyOrClass<T>[], tags: TypeToken<T> | TypeToken<T>[]): void;

	/**
	 * Resolve all of the bindings for a given tag or tags.
	 *
	 * This method returns a generator so that you can iterate lazily over the
	 * results and each service will not be created until required.
	 *
	 * @example
	 * for (const report of container.tagged(reportTag)) {
	 *     // process each report, lazily creating them
	 * }
	 * // eagerly create all reports
	 * const reports = Array.from(container.tagged(reportTag));
	 */
	tagged<T>(tags: TypeToken<T> | TypeToken<T>[]): Generator<T, void, void>;

	/**
	 * Define a contextual binding.
	 *
	 * This allows you to override the value given to an object being created by
	 * the container. The syntax is:
	 *
	 * ```
	 * container.when(subject).needs(dependency).give(implementation)
	 * ```
	 *
	 * - `subject`: the object being built
	 * - `dependency`: the dependency requested by the subject
	 * - `implementation`: the implementation to give, something that can be passed to container.get(implementation)
	 *
	 * @example
	 * container
	 *     .when(OrderProcessor)
	 *     .needs(IPaymentGateway)
	 *     .give(StripePaymentGateway)
	 */
	when(consumer: KeyOrClass | KeyOrClass[]): ContextualBindingBuilder;
}

/***/
export const Container: TypeToken<Container> = createTypeToken("Container");
