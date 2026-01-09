import { BeynacError } from "../core/core-errors.ts";
import { getKeyName, type KeyOrClass } from "./container-key.ts";
import { NO_VALUE, type NoValue } from "./no-value.ts";

const invalidInjectMessage = `Dependencies that use inject() must be created by the container`;

/**
 * Inject a dependency into a class constructor. Use this method with JavaScript
 * default argument syntax in the constructor of a class. When an instance of
 * the class is being built by the IoC Container, the correct dependency will be
 * provided.
 *
 * @param token a type token created with typeKey or a class reference
 *
 * @example
 * class MyClass {
 *     // inferred type of this.emailService is EmailService
 *     constructor(private emailService = inject(EmailService)) {}
 * }
 * // in your app: instance will have EmailService injected
 * const instance = container.make(MyClass);
 * // in your tests: you can supply a mock dependency
 * const instance = new MyClass(new MockEmailService());
 */
export function inject<T>(arg: KeyOrClass<T>): T {
	if (!_currentInjectHandler) {
		throw new BeynacError(invalidInjectMessage);
	}
	return resolveRequired(_currentInjectHandler, arg);
}

/**
 * Inject an optional dependency into a class constructor. Use like `inject()`.
 * If the dependency is not bound, it will be injected as null.
 *
 * @param token a type token created with typeKey or a class reference
 * @see inject
 *
 * @example
 * class MyClass {
 *     // inferred type of this.emailService is EmailService | null
 *     constructor(private emailService = injectOptional(EmailService)) {}
 * }
 * // in your app: instance will have EmailService injected if available
 * const instance = container.make(MyClass);
 * // in your tests: you can supply a mock dependency
 * const instance = new MyClass(new MockEmailService());
 */
export function injectOptional<T>(arg: KeyOrClass<T>): T | null {
	if (!_currentInjectHandler) {
		throw new BeynacError(invalidInjectMessage);
	}
	return resolveOptional(_currentInjectHandler, arg);
}

/**
 * Inject a dependency factory into a class constructor. Use this method with
 * JavaScript default argument syntax in the constructor of a class. Returns a
 * no-argument function that when called returns the dependency.
 *
 * This is useful as an alternative to inject() for transient and scoped
 * dependencies when you want to be able to create fresh instances on demand.
 *
 * Another use case is to break circular dependencies. If you have two singleton
 * classes A and B and both require a reference to the other, you can't have
 * both accept a reference to the other as a constructor argument, but you can
 * have one accept a factory function that returns the other and lazily wire up
 * the circular reference.
 *
 * @param token a type token created with typeKey or a class reference
 *
 * @example
 * class MyClass {
 *     // inferred type of this.getEmailService is () => EmailService
 *     constructor(private getEmailService = injectFactory(EmailService)) {}
 *     sendEmail() {
 *         this.getEmailService().send(...);
 *     }
 * }
 * // in your app: instance will have EmailService factory injected
 * const instance = container.make(MyClass);
 * // in your tests: you can supply a mock dependency factory
 * const instance = new MyClass(() => new MockEmailService());
 */
export function injectFactory<T>(arg: KeyOrClass<T>): () => T {
	if (!_currentInjectHandler) {
		throw new BeynacError(invalidInjectMessage);
	}
	const handler = _currentInjectHandler;
	return () => resolveRequired(handler, arg);
}

/**
 * Inject an optional dependency factory into a class constructor. Use like
 * `injectFactory()`. Returns a no-argument function that when called returns
 * the dependency or null if not bound.
 *
 * @param token a type token created with typeKey or a class reference
 * @see injectFactory
 *
 * @example
 * class MyClass {
 *     // inferred type of this.getEmailService is () => EmailService | null
 *     constructor(private getEmailService = injectFactoryOptional(EmailService)) {}
 *     sendEmail() {
 *         const service = this.getEmailService();
 *         if (service) service.send(...);
 *     }
 * }
 * // in your app: instance will have EmailService factory injected if available
 * const instance = container.make(MyClass);
 * // in your tests: you can supply a mock dependency factory
 * const instance = new MyClass(() => new MockEmailService());
 */
export function injectFactoryOptional<T>(arg: KeyOrClass<T>): () => T | null {
	if (!_currentInjectHandler) {
		throw new BeynacError(invalidInjectMessage);
	}
	const handler = _currentInjectHandler;
	return () => resolveOptional(handler, arg);
}

type InjectHandler = <T>(arg: KeyOrClass<T>, optional: boolean) => T | NoValue;

function resolveRequired<T>(handler: InjectHandler, arg: KeyOrClass<T>): T {
	const result = handler(arg, false);
	if (result === NO_VALUE) {
		throw new BeynacError(`Required dependency ${getKeyName(arg)} not found`);
	}
	return result;
}

function resolveOptional<T>(handler: InjectHandler, arg: KeyOrClass<T>): T | null {
	let result: unknown = handler(arg, true);
	if (result === NO_VALUE) {
		result = null;
	}
	return (result ?? null) as T;
}

let _currentInjectHandler: InjectHandler | null = null;

export const _getInjectHandler = (): InjectHandler | null => {
	return _currentInjectHandler;
};

export const _setInjectHandler = (handler: InjectHandler | null): void => {
	_currentInjectHandler = handler;
};
