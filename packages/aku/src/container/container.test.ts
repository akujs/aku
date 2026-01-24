import { beforeEach, describe, expect, expectTypeOf, mock, spyOn, test } from "bun:test";
import { asyncGate } from "../test-utils/async-gate.bun.ts";
import { allowDefaultBindings, ContainerImpl } from "./ContainerImpl.ts";
import type { KeyOrClass } from "./container-key.ts";
import { createTypeToken } from "./container-key.ts";
import type { Container } from "./contracts/Container.ts";
import { inject, injectFactory, injectFactoryOptional, injectOptional } from "./inject.ts";

allowDefaultBindings();

let container: Container;

beforeEach(() => {
	container = new ContainerImpl();
	Dep.instantiations = 0;
});

test("resolution of bound type token", () => {
	const name = createTypeToken<string>();
	container.bind(name, { factory: () => "Bernie" });
	expect(container.get(name)).toBe("Bernie");
});

test("failed resolution of unbound token", () => {
	const string = createTypeToken("Test");
	expect(() => container.get(string)).toThrowErrorMatchingInlineSnapshot(
		`"Can't create an instance of [Test] because no value or factory function was supplied"`,
	);
});

test("resolution of bound class with injected dependencies", () => {
	const nameToken = createTypeToken<string>("name");
	class HasNameDependency {
		constructor(public name = inject(nameToken)) {}
	}
	container.bind(nameToken, { factory: () => "Bernie" });
	container.bind(HasNameDependency);
	expect(container.get(HasNameDependency).name).toBe("Bernie");
});

test("resolution of bound class with factory function and injected dependencies", () => {
	const nameToken = createTypeToken<string>("name");
	class HasNameDependency {
		constructor(public name = inject(nameToken)) {}
	}
	container.bind(nameToken, { factory: () => "Bernie" });
	container.bind(HasNameDependency, {
		factory: () => new HasNameDependency(),
	});
	expect(container.get(HasNameDependency).name).toBe("Bernie");
});

test("resolution of an unbound class value", () => {
	class Foo {}
	const foo1 = container.get(Foo);
	const foo2 = container.get(Foo);
	expect(foo1).toBeInstanceOf(Foo);
	expect(foo2).toBeInstanceOf(Foo);
	expect(foo1).not.toBe(foo2);
});

test("error when trying to instantiate a value with unbound dependencies", () => {
	const nameToken = createTypeToken<string>("name");
	class HasNameDependency {
		constructor(public name = inject(nameToken)) {}
	}
	expect(() => new HasNameDependency()).toThrowErrorMatchingInlineSnapshot(
		`"Dependencies that use inject() must be created by the container"`,
	);
});

test("auto-resolution of class with auto-resolvable dependencies", () => {
	class A {
		constructor(public b = inject(B)) {}
	}
	class B {
		value = "hi";
	}
	expect(container.get(A)).toMatchObject({ b: { value: "hi" } });
});

test("error when resolving a value with missing injected dependencies", () => {
	const nameToken = createTypeToken<string>("name");
	class HasNameDependency {
		constructor(public name = inject(nameToken)) {}
	}
	container.bind(HasNameDependency);
	expect(() => container.get(HasNameDependency)).toThrowErrorMatchingInlineSnapshot(
		`"Can't create an instance of [name] because no value or factory function was supplied (while building [HasNameDependency])"`,
	);
});

test("abstract can be bound from concrete type", () => {
	class Foo {}
	container.bind(Foo);
	expect(container.get(Foo)).toBeInstanceOf(Foo);
});

test("can create a null-returning factory function", () => {
	const token = createTypeToken<string | null>();
	container.bind(token, { factory: () => null });
	expect(container.bound(token)).toBe(true);
	expect(container.get(token)).toBe(null);
});

test("can create a null-returning factory function for a singleton", () => {
	const token = createTypeToken<string | null>();
	const factory = mock(() => null);
	container.bind(token, { factory, lifecycle: "singleton" });
	expect(container.bound(token)).toBe(true);
	expect(container.get(token)).toBe(null);
	expect(factory).toHaveBeenCalledTimes(1);
});

test("error when binding without providing class, factory, or instance", () => {
	const token = createTypeToken();
	// @ts-expect-error -- testing runtime error for invalid bind call
	expect(() => container.bind(token)).toThrow("Must provide class, factory, or instance");
});

test("bound checks if a type token is bound", () => {
	const token = createTypeToken();
	expect(container.bound(token)).toBe(false);
	container.bind(token, { factory: () => false });
	expect(container.bound(token)).toBe(true);
});

test("bound checks if a class is bound", () => {
	class Foo {}
	expect(container.bound(Foo)).toBe(false);
	container.bind(Foo);
	expect(container.bound(Foo)).toBe(true);
});

test("bindIf doesn't register if service already registered", () => {
	const name = createTypeToken();
	container.bind(name, { factory: () => "Bernie" });
	container.bind(name, { factory: () => "Miguel", ifNotBound: true });

	expect(container.get(name)).toBe("Bernie");
});

test("bindIf does register if service not registered yet", () => {
	const surname = createTypeToken();
	const name = createTypeToken();
	container.bind(surname, { factory: () => "Sumption" });
	container.bind(name, { factory: () => "Bernie", ifNotBound: true });

	expect(container.get(name)).toBe("Bernie");
});

test("instance registers an instance of a class", () => {
	container.bind(Dep, {
		instance: new Dep("instance"),
		lifecycle: "singleton",
	});
	expect(container.getLifecycle(Dep)).toBe("singleton");
	expect(container.get(Dep).name).toBe("instance");
});

test("instance registers an instance for a token", () => {
	const token = createTypeToken<Dep>();
	container.bind(token, {
		instance: new Dep("instance"),
		lifecycle: "singleton",
	});
	expect(container.getLifecycle(token)).toBe("singleton");
	expect(container.get(token).name).toBe("instance");
});

test("resolved resolves alias to binding name before checking", () => {
	class Foo {}
	container.bind(Foo);
	const fooAlias = createTypeToken<Foo>();
	container.alias({ from: fooAlias, to: Foo });

	expect(container.resolved(Foo)).toBe(false);
	expect(container.resolved(fooAlias)).toBe(false);

	container.get(Foo);

	expect(container.resolved(Foo)).toBe(true);
	expect(container.resolved(fooAlias)).toBe(true);
});

test("resolved considers provided shared instance to be resolved", () => {
	class Foo {}

	expect(container.resolved(Foo)).toBe(false);

	container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

	expect(container.resolved(Foo)).toBe(true);
});

test("alias to bound type token", () => {
	const from = createTypeToken();
	const to = createTypeToken();
	container.bind(to, { factory: () => "to value" });
	container.alias({ from, to });
	expect(container.get(from)).toBe("to value");
});

test("alias to bound class reference", () => {
	class Foo {}
	const foo = new Foo();
	const from = createTypeToken<Foo>();
	container.bind(Foo, { factory: () => foo });
	container.alias({ from, to: Foo });
	expect(container.get(from)).toBe(foo);
});

test("alias to unbound type token", () => {
	const from = createTypeToken("from");
	const to = createTypeToken("to");
	container.alias({ from, to });
	expect(() => container.get(from)).toThrowErrorMatchingInlineSnapshot(
		`"Can't create an instance of [to] because no value or factory function was supplied"`,
	);
});

test("alias to unbound class reference", () => {
	class Foo {}
	const from = createTypeToken<Foo>();
	container.alias({ from, to: Foo });
	const instance = container.get(from);
	expect(instance).toBeInstanceOf(Foo);
	// not a singleton
	expect(container.get(from)).not.toBe(instance);
	expect(container.bound(Foo)).toBe(false);
});

test("error message when following circular alias", () => {
	const quux = createTypeToken("quux");
	const foo = createTypeToken("foo");
	const bar = createTypeToken("bar");
	const baz = createTypeToken("baz");
	container.alias({ from: quux, to: foo });
	container.alias({ from: foo, to: bar });
	container.alias({ from: bar, to: baz });
	container.alias({ from: baz, to: foo });
	expect(() => container.get(quux)).toThrowErrorMatchingInlineSnapshot(
		`"Circular alias detected: [foo] -> [bar] -> [baz] -> [foo]"`,
	);
});

test("singleton token resolution", () => {
	const token = createTypeToken<object>();
	container.bind(token, {
		factory: () => {
			return {};
		},
		lifecycle: "singleton",
	});
	const first = container.get(token);
	const second = container.get(token);
	expect(first).toBe(second);
});

test("singleton class resolution", () => {
	class ContainerConcreteStub {}
	container.singleton(ContainerConcreteStub);

	const var1 = container.get(ContainerConcreteStub);
	const var2 = container.get(ContainerConcreteStub);
	expect(var1).toBe(var2);
});

test("singletonIf doesn't register if binding already registered", () => {
	const token = createTypeToken<{ type: string }>();
	container.bind(token, {
		factory: () => ({ type: "a" }),
		lifecycle: "singleton",
	});
	const firstInstantiation = container.get(token);
	container.bind(token, {
		factory: () => ({ type: "b" }),
		lifecycle: "singleton",
		ifNotBound: true,
	});
	const secondInstantiation = container.get(token);
	expect(firstInstantiation).toBe(secondInstantiation);
	expect(firstInstantiation).toEqual({ type: "a" });
});

test("singletonIf does register if binding not registered yet", () => {
	const token = createTypeToken();
	const otherToken = createTypeToken<{ type: string }>();
	container.bind(token, { factory: () => ({}), lifecycle: "singleton" });
	container.bind(otherToken, {
		factory: () => ({ type: "a" }),
		lifecycle: "singleton",
		ifNotBound: true,
	});
	const firstInstantiation = container.get(otherToken);
	const secondInstantiation = container.get(otherToken);
	expect(firstInstantiation).toBe(secondInstantiation);
	expect(firstInstantiation).toEqual({ type: "a" });
});

test("scopedIf", async () => {
	const token = createTypeToken<string>();
	container.bind(token, {
		factory: () => "foo",
		lifecycle: "scoped",
		ifNotBound: true,
	});

	await container.withScope(async () => {
		expect(container.get(token)).toBe("foo");
		container.bind(token, {
			factory: () => "bar",
			lifecycle: "scoped",
			ifNotBound: true,
		});
		expect(container.get(token)).toBe("foo");
		expect(container.get(token)).not.toBe("bar");
	});
});

test("auto concrete resolution", () => {
	class Foo {}
	expect(container.get(Foo)).toBeInstanceOf(Foo);
	expect(container.bound(Foo)).toBe(false);
});

test("abstract to concrete resolution", () => {
	abstract class Parent {}
	class Child extends Parent {}
	class Dependent {
		constructor(public impl = inject(Parent)) {}
	}

	container.bind(Parent, Child);
	const instance = container.get(Dependent);
	expect(instance.impl).toBeInstanceOf(Child);
});

test("can bind parent classes with required args to child classes without required args", () => {
	abstract class Parent {
		constructor(public value: string) {}
	}
	class Child extends Parent {
		constructor() {
			super("child-value");
		}
	}

	class Dependent {
		constructor(public impl = inject(Parent)) {}
	}

	container.bind(Parent, Child);
	const instance = container.get(Dependent);
	expect(instance.impl).toBeInstanceOf(Child);
	expect(instance.impl.value).toBe("child-value");
});

test("runtime error when auto-instantiating a class with required args", () => {
	class Mandatory {
		constructor(public value: string) {}
	}

	class Dependent {
		constructor(public impl = inject(Mandatory)) {}
	}

	expect(() => container.get(Dependent)).toThrowError(
		'Can\'t create an instance of [Mandatory] because it looks like it has required constructor arguments. Either bind it to the container, or ensure that all arguments have default values e.g. constructor(arg = "default")',
	);
});

test("can bind an instance using a class with required args as a key", () => {
	class Mandatory {
		constructor(public value: string) {}
	}

	container.singletonInstance(Mandatory, new Mandatory("value"));
	container.singletonInstanceIf(Mandatory, new Mandatory("value"));
});

test("type error on attempting to use a class with mandatory args as an implementation", () => {
	class Mandatory {
		constructor(public value: string) {}
	}
	const type = createTypeToken<Mandatory>();

	// Can bind with factory
	container.bind(Mandatory, { factory: () => new Mandatory("value") });
	// @ts-expect-error -- testing expected error
	container.bind(Mandatory, Mandatory);
	// @ts-expect-error -- testing expected error
	container.bindIf(Mandatory);
	// @ts-expect-error -- testing expected error
	container.bindIf(Mandatory, Mandatory);
	// @ts-expect-error -- testing expected error
	container.singleton(Mandatory);
	// @ts-expect-error -- testing expected error
	container.singleton(Mandatory, Mandatory);
	// @ts-expect-error -- testing expected error
	container.singletonIf(Mandatory);
	// @ts-expect-error -- testing expected error
	container.singletonIf(Mandatory, Mandatory);
	// @ts-expect-error -- testing expected error
	container.scoped(Mandatory);
	// @ts-expect-error -- testing expected error
	container.scoped(Mandatory, Mandatory);
	// @ts-expect-error -- testing expected error
	container.scopedIf(Mandatory);
	// @ts-expect-error -- testing expected error
	container.scopedIf(Mandatory, Mandatory);
	// type.class requires NoArgConstructor
	container.bind(type, { class: Mandatory });
});

test("can bind parent classes with required args to factory functions", () => {
	class Cls {
		constructor(public value: string) {}
	}

	class Dependent {
		constructor(public impl = inject(Cls)) {}
	}

	container.bind(Cls, { factory: () => new Cls("factory-value") });
	const instance = container.get(Dependent);
	expect(instance.impl).toBeInstanceOf(Cls);
	expect(instance.impl.value).toBe("factory-value");
});

test("nested dependency resolution", () => {
	interface Contract {
		_?: number;
	}
	const Contract = createTypeToken<Contract>("Contract");
	class Impl implements Contract {}
	class Dependent {
		constructor(public impl = inject(Contract)) {}
	}
	class NestedDependent {
		constructor(public inner = inject(Dependent)) {}
	}

	container.bind(Contract, { factory: () => new Impl() });
	const instance = container.get(NestedDependent);
	expect(instance.inner).toBeInstanceOf(Dependent);
	expect(instance.inner.impl).toBeInstanceOf(Impl);
});

test("container is passed to resolvers", () => {
	const token = createTypeToken();
	container.bind(token, {
		factory: (c) => {
			return c;
		},
	});
	const c = container.get(token);
	expect(c).toBe(container);
});

test("binding an instance as shared", () => {
	class Foo {}
	const bound = new Foo();
	container.bind(Foo, { instance: bound, lifecycle: "singleton" });
	expect(container.get(Foo)).toBe(bound);
	expect(container.getLifecycle(Foo)).toBe("singleton");
});

test("lifecycle can be omitted when binding an instance", () => {
	class Foo {}
	const bound = new Foo();
	container.bind(Foo, { instance: bound });
	expect(container.get(Foo)).toBe(bound);
	expect(container.getLifecycle(Foo)).toBe("singleton");
});

test("resolution of default constructor arguments", () => {
	class Dependency {}
	class Dependent {
		constructor(
			public stub = inject(Dependency),
			public defaultVal = "Bernie",
		) {}
	}

	const instance = container.get(Dependent);
	expect(instance.stub).toBeInstanceOf(Dependency);
	expect(instance.defaultVal).toBe("Bernie");
});

test("binding or making a class with non-default constructor args produces a type error", () => {
	class MandatoryArgs {
		constructor(public foo: string) {}
	}
	// Can bind with factory
	container.bind(MandatoryArgs, { factory: () => new MandatoryArgs("arg") });
	// Can call get() with any class, runtime error will fire if unbound
	container.get(MandatoryArgs);
});

test("error on attempting to auto-resolve an abstract class", () => {
	interface I {
		foo: string;
	}
	const Parent = createTypeToken<I>("I");
	expect(() => container.get(Parent)).toThrowErrorMatchingInlineSnapshot(
		`"Can't create an instance of [I] because no value or factory function was supplied"`,
	);
});

test("resolution of class with optional dependency", () => {
	class OptionalInject {
		constructor(
			public noDefault = inject(Dep),
			public defaultVal = injectOptional(Dep),
		) {}
	}

	const instance = container.get(OptionalInject);
	expect(instance.noDefault).toBeInstanceOf(Dep);
	expect(instance.defaultVal).toBe(null);

	container.bind(Dep, { factory: () => new Dep() });
	const instance2 = container.get(OptionalInject);
	expect(instance2.defaultVal).toBeInstanceOf(Dep);
});

test("resolution of class with optional dependency and contextual bindings", () => {
	class AltDep extends Dep {}
	class OptionalInject {
		constructor(
			public noDefault = inject(Dep),
			public defaultVal = injectOptional(Dep),
		) {}
	}

	container
		.when(OptionalInject)
		.needs(Dep)
		.create(() => new AltDep());
	const instance = container.get(OptionalInject);
	expect(instance.defaultVal).toBeInstanceOf(AltDep);
});

test("resolution of class with factory dependency", () => {
	class FactoryInject {
		constructor(public getDep = injectFactory(Dep)) {}
	}

	const instance = container.get(FactoryInject);
	expect(typeof instance.getDep).toBe("function");
	expect(instance.getDep()).toBeInstanceOf(Dep);
});

test("resolution of class with factory dependency and contextual bindings", () => {
	class AltDep extends Dep {}
	class FactoryInject {
		constructor(public getDep = injectFactory(Dep)) {}
	}

	container
		.when(FactoryInject)
		.needs(Dep)
		.create(() => new AltDep());
	const instance = container.get(FactoryInject);
	expect(instance.getDep()).toBeInstanceOf(AltDep);
});

test("error when trying to use injectFactory with unbound dependencies", () => {
	const unboundToken = createTypeToken<string>("unbound");
	class FactoryInject {
		constructor(public getDep = injectFactory(unboundToken)) {}
	}

	const instance = container.get(FactoryInject);
	expect(() => instance.getDep()).toThrow();
});

test("injectFactory respects singleton lifecycle", () => {
	class FactoryInject {
		constructor(public getDep = injectFactory(Dep)) {}
	}

	container.singleton(Dep);
	const instance = container.get(FactoryInject);
	const dep1 = instance.getDep();
	const dep2 = instance.getDep();
	expect(dep1).toBe(dep2); // same instance each call for singleton
});

test("injectFactory respects transient lifecycle", () => {
	class FactoryInject {
		constructor(public getDep = injectFactory(Dep)) {}
	}

	container.bind(Dep);
	const instance = container.get(FactoryInject);
	const dep1 = instance.getDep();
	const dep2 = instance.getDep();
	expect(dep1).not.toBe(dep2); // different instance each call for transient
});

test("resolution of class with optional factory dependency", () => {
	class OptionalFactoryInject {
		constructor(public getDep = injectFactoryOptional(Dep)) {}
	}

	const instance = container.get(OptionalFactoryInject);
	expect(typeof instance.getDep).toBe("function");
	expect(instance.getDep()).toBe(null);

	container.bind(Dep, { factory: () => new Dep() });
	const instance2 = container.get(OptionalFactoryInject);
	expect(instance2.getDep()).toBeInstanceOf(Dep);
});

test("getIfAvailable", () => {
	class TransientDep {}
	class SingletonDep {}
	class ScopedDep {}

	// Should be available before bound because implicit binding is transient
	expect(container.getIfAvailable(TransientDep)).toBeInstanceOf(TransientDep);

	container.bind(TransientDep);
	expect(container.getIfAvailable(TransientDep)).toBeInstanceOf(TransientDep);

	container.singleton(SingletonDep);
	expect(container.getIfAvailable(SingletonDep)).toBeInstanceOf(SingletonDep);

	container.scoped(ScopedDep);
	// Null outside scope
	expect(container.getIfAvailable(ScopedDep)).toBeUndefined();
	// Available in scope
	container.withScope(() => {
		expect(container.getIfAvailable(ScopedDep)).toBeInstanceOf(ScopedDep);
	});
});

test("bound", () => {
	class Foo {}
	const alias = createTypeToken<Foo>();
	container.bind(Foo);
	expect(container.bound(Foo)).toBe(true);
	expect(container.bound(alias)).toBe(false);

	const container2 = new ContainerImpl();
	container2.alias({ from: alias, to: Foo });
	expect(container2.bound(alias)).toBe(true);
	expect(container2.bound(Foo)).toBe(false);
});

test("alias clears binding", () => {
	class Foo {
		constructor(public string?: string) {}
	}
	const token = createTypeToken<Foo>();
	container.bind(token, { factory: () => new Foo("bound by token") });
	container.bind(Foo, { factory: () => new Foo("bound by class") });
	expect(container.get(token).string).toBe("bound by token");
	expect(container.get(Foo).string).toBe("bound by class");

	container.alias({ from: token, to: Foo });
	expect(container.get(token).string).toBe("bound by class");
});

test("rebound listeners", () => {
	const token = createTypeToken<string>();

	container.bind(token, { factory: () => "a" });

	let fireCount = 0;
	container.onRebinding(token, (instance, c) => {
		expect(instance).toBe("b");
		expect(c).toBe(container);
		++fireCount;
	});
	container.bind(token, { factory: () => "b" });

	expect(fireCount).toBe(1);
});

test("rebound listeners only fires if was already bound", () => {
	const token = createTypeToken<string>();

	let fireCount = 0;
	container.onRebinding(token, () => {
		++fireCount;
	});
	container.bind(token, { factory: () => "b" });

	expect(fireCount).toBe(0);
});

test("rebound listeners on instances", () => {
	class Foo {}

	container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

	let fireCount = 0;
	container.onRebinding(Foo, () => {
		++fireCount;
	});
	container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

	expect(fireCount).toBe(1);
});

test("rebound listeners on instances only fires if was already bound", () => {
	class Foo {}

	let fireCount = 0;
	container.onRebinding(Foo, () => {
		++fireCount;
	});
	container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

	expect(fireCount).toBe(0);
});

test("binding resolution exception message includes build stack", () => {
	class A {
		constructor(public b = inject(B)) {}
	}
	class B {
		constructor(public c = inject(C)) {}
	}
	const C = createTypeToken("C");

	expect(() => {
		container.get(A);
	}).toThrowErrorMatchingInlineSnapshot(
		`"Can't create an instance of [C] because no value or factory function was supplied (while building [A] -> [B])"`,
	);
});

test("currently resolving", () => {
	class Foo {
		key: KeyOrClass | null;
		constructor() {
			this.key = container.currentlyResolving();
		}
	}

	expect(new Foo().key).toBe(null);
	expect(container.get(Foo).key).toBe(Foo);
	const token = createTypeToken<Foo>();
	container.bind(token, { factory: () => new Foo() });
	expect(container.get(token).key).toBe(token);
	container.bind(Foo);
	expect(container.get(Foo).key).toBe(Foo);
});

test("it throws exception when abstract is same as alias", () => {
	const token = createTypeToken("tokenName");
	expect(() => {
		container.alias({ from: token, to: token });
	}).toThrowErrorMatchingInlineSnapshot(`"[tokenName] is aliased to itself."`);
	class Foo {}
	expect(() => {
		container.alias({ from: Foo, to: Foo });
	}).toThrowErrorMatchingInlineSnapshot(`"[Foo] is aliased to itself."`);
});

test("invoke() with injected args", () => {
	class Foo {
		getDepName(dep = inject(Dep)) {
			return dep.name;
		}
	}

	const name = container.invoke(new Foo(), "getDepName");

	expect(name).toBe("default");

	expect(() => new Foo().getDepName()).toThrowErrorMatchingInlineSnapshot(
		`"Dependencies that use inject() must be created by the container"`,
	);
});

test("invoke() with required non-injected args", () => {
	class Foo {
		getDepName(mandatory: string, dep = inject(Dep)) {
			return mandatory + dep.name;
		}
	}

	// @ts-expect-error -- should be an error to omit the required arg
	container.invoke(new Foo(), "getDepName");

	const result = container.invoke(new Foo(), "getDepName", "prefix:");
	expect(result).toBe("prefix:default");
});

test("invoke() with optional non-injected args", () => {
	class Foo {
		getDepName(optional = "not-provided:", dep = inject(Dep)) {
			return optional + dep.name;
		}
	}

	expect(container.invoke(new Foo(), "getDepName")).toBe("not-provided:default");

	expect(container.invoke(new Foo(), "getDepName", "provided:")).toBe("provided:default");
});

test("construct() with required arg", () => {
	class Foo {
		constructor(
			public mandatory: number,
			public injected = inject(Dep),
		) {}
	}

	const foo = container.construct(Foo, 42);

	// @ts-expect-error -- should be an error not to provide a mandatory arg
	container.construct(Foo);

	expect(foo.mandatory).toBe(42);
	expect(foo.injected).toBeInstanceOf(Dep);
});

test("construct() with optional arg", () => {
	class Foo {
		constructor(
			public mandatory?: number,
			public injected = inject(Dep),
		) {}
	}

	let foo = container.construct(Foo, 80);
	expect(foo.mandatory).toBe(80);
	expect(foo.injected).toBeInstanceOf(Dep);

	foo = container.construct(Foo);
	expect(foo.mandatory).toBeUndefined();
	expect(foo.injected).toBeInstanceOf(Dep);
});

test("withInject with dependency injection", () => {
	const result = container.withInject(() => {
		const dep = inject(Dep);
		return dep.name;
	});

	expect(result).toBe("default");

	// Without withInject, inject should throw
	expect(() => {
		const dep = inject(Dep);
		return dep.name;
	}).toThrowErrorMatchingInlineSnapshot(
		`"Dependencies that use inject() must be created by the container"`,
	);
});

test("withInject with custom bound dependency", () => {
	container.bind(Dep, { factory: () => new Dep("custom") });

	const result = container.withInject(() => {
		const dep = inject(Dep);
		return dep.name;
	});

	expect(result).toBe("custom");
});

test("withInject returns closure return value", () => {
	const result = container.withInject(() => {
		return { value: 42, nested: { data: "test" } };
	});

	expect(result).toEqual({ value: 42, nested: { data: "test" } });
});

test("withInject closure with no dependencies", () => {
	const result = container.withInject(() => "hello world");
	expect(result).toBe("hello world");
});

test("container can catch circular dependency", () => {
	class Root {
		constructor(public a: unknown = inject(A)) {}
	}
	class A {
		constructor(public b: unknown = inject(B)) {}
	}
	class B {
		constructor(public c: unknown = inject(C)) {}
	}
	class C {
		constructor(public a: unknown = inject(A)) {}
	}

	expect(() => container.get(Root)).toThrowErrorMatchingInlineSnapshot(
		`"Circular dependency detected: [A] -> [B] -> [C] -> [A] (while building [Root] -> [A] -> [B] -> [C])"`,
	);
});

describe("Container contextual bindings", () => {
	test("contextual binding can provide different dependencies based on context", () => {
		const token = createTypeToken<Dep>("Dep");
		container.bind(token, { factory: () => new Dep("token") });

		class Class extends Dep {
			constructor() {
				super("class");
			}
		}

		class A {
			constructor(public dep = inject(Dep)) {}
		}
		class B {
			constructor(public dep = inject(Dep)) {}
		}
		class C {
			constructor(public dep = inject(Dep)) {}
		}
		class D {
			constructor(public dep = inject(Dep)) {}
		}

		container.when(A).needs(Dep).give(token);
		container.when(B).needs(Dep).give(Class);
		let createArg: unknown;
		container
			.when(C)
			.needs(Dep)
			.create((c) => {
				createArg = c;
				return new Dep("created");
			});

		expect(container.get(A).dep.name).toBe("token");
		expect(container.get(B).dep.name).toBe("class");
		expect(container.get(C).dep.name).toBe("created");
		expect(container.get(D).dep.name).toBe("default");
		expect(createArg).toBe(container);
	});

	test("contextual binding works for existing instanced bindings", () => {
		container.bind(Dep, {
			instance: new Dep("instance"),
			lifecycle: "singleton",
		});

		class A {
			constructor(public dep = inject(Dep)) {}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		expect(container.get(A).dep.name).toBe("contextual");
	});

	test("contextual binding works for key", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		const token = createTypeToken<A>();
		container.bind(token, { factory: () => new A() });

		container
			.when(token)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		expect(container.get(token).dep.name).toBe("contextual");
	});

	test("contextual binding works for aliased key already created", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		const alias = createTypeToken<A>();
		const token = createTypeToken<A>();
		container.bind(token, { factory: () => new A() });
		container.alias({ from: alias, to: token });

		container
			.when(token)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		expect(container.get(token).dep.name).toBe("contextual");
	});

	test("contextual binding works for aliased key created later", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		const alias = createTypeToken<A>();
		const token = createTypeToken<A>();

		container
			.when(token)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		container.bind(token, { factory: () => new A() });
		container.alias({ from: alias, to: token });

		expect(container.get(token).dep.name).toBe("contextual");
	});

	test("can contextually override with null", () => {
		const token = createTypeToken<Dep | null>();
		class B {
			constructor(public dep = inject(token)) {}
		}
		class A {
			constructor(public dep = inject(token)) {}
		}
		container.bind(token, { factory: () => new Dep() });

		container
			.when(A)
			.needs(token)
			.create(() => null);

		expect(container.get(A).dep).toBe(null);
		expect(container.get(B).dep).toBeInstanceOf(Dep);
	});

	test("contextual binding works for newly instanced bindings", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("override"));

		container.bind(Dep, {
			instance: new Dep("instance"),
			lifecycle: "singleton",
		});

		expect(container.get(A).dep.name).toBe("override");
	});

	test("contextual binding works on existing aliased instances", () => {
		const instance = createTypeToken<Dep>("instance");
		container.bind(instance, {
			instance: new Dep("instance"),
		});
		const alias = createTypeToken<Dep>("alias");
		container.alias({ from: alias, to: instance });

		class A {
			constructor(public dep = inject(alias)) {}
		}

		container
			.when(A)
			.needs(alias)
			.create(() => new Dep("override"));

		expect(container.get(A).dep.name).toBe("override");
	});

	test("contextual binding can replace an instance with null", () => {
		const instance = createTypeToken<Dep | null>("instance");
		container.bind(instance, {
			instance: new Dep("instance"),
			lifecycle: "singleton",
		});
		const alias = createTypeToken<Dep | null>("alias");
		container.alias({ from: alias, to: instance });

		class A {
			constructor(public dep = inject(alias)) {}
		}

		container
			.when(A)
			.needs(alias)
			.create(() => null);

		expect(container.get(A).dep).toBe(null);
	});

	test("contextual binding works on new aliased instances", () => {
		const instance = createTypeToken<Dep>("instance");
		const alias = createTypeToken<Dep>("alias");

		class A {
			constructor(public dep = inject(alias)) {}
		}

		container
			.when(A)
			.needs(alias)
			.create(() => new Dep("override"));

		container.bind(instance, {
			instance: new Dep("instance"),
			lifecycle: "singleton",
		});
		container.alias({ from: alias, to: instance });

		expect(container.get(A).dep.name).toBe("override");
	});

	test("contextual binding does not pick up stale re-aliased references", () => {
		const dummy = createTypeToken<Dep>("dummy");
		const alias = createTypeToken<Dep>("alias");
		const unrelated = createTypeToken<Dep>("unrelated");
		const instance = createTypeToken<Dep>("instance");

		class A {
			constructor(public dep = inject(alias)) {}
		}

		container
			.when(A)
			.needs(dummy)
			.create(() => new Dep("bad override"));

		container
			.when(A)
			.needs(alias)
			.create(() => new Dep("good override"));

		container.bind(instance, {
			instance: new Dep("instance"),
			lifecycle: "singleton",
		});
		container.alias({ from: dummy, to: instance });
		container.alias({ from: alias, to: instance });
		container.alias({ from: dummy, to: unrelated });

		expect(container.get(A).dep.name).toBe("good override");
	});

	test("contextual binding works on new aliased bindings", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		const stub = createTypeToken<Dep>("stub");

		container
			.when(A)
			.needs(stub)
			.create(() => new Dep("correct"));

		container.bind(Dep, { factory: () => new Dep("incorrect") });
		container.bind(stub, { factory: () => new Dep("incorrect") });
		container.alias({ from: Dep, to: stub });

		expect(container.get(A).dep.name).toBe("correct");
	});

	test("contextual binding works on existing aliased bindings", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}

		const stub = createTypeToken<Dep>("stub");
		container.bind(Dep, { factory: () => new Dep("incorrect") });
		container.bind(stub, { factory: () => new Dep("incorrect") });
		container.alias({ from: Dep, to: stub });

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("correct"));

		expect(container.get(A).dep.name).toBe("correct");
	});

	test("contextual binding works for multiple classes", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		class B {
			constructor(public dep = inject(Dep)) {}
		}
		class C {
			constructor(public dep = inject(Dep)) {}
		}

		container
			.when([A, B])
			.needs(Dep)
			.create(() => new Dep("correct"));

		expect(container.get(A).dep.name).toBe("correct");
		expect(container.get(B).dep.name).toBe("correct");
		expect(container.get(C).dep.name).toBe("default");
	});

	test("contextual binding doesn't override non-contextual resolution", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		class B {
			constructor(public dep = inject(Dep)) {}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		expect(container.get(A).dep.name).toBe("contextual");

		expect(container.get(B).dep.name).toBe("default");
	});

	test("contextual binding doesn't override non-contextual resolution of aliases", () => {
		const stub = createTypeToken<Dep>();
		container.bind(stub, { instance: new Dep("stub"), lifecycle: "singleton" });
		container.alias({ from: Dep, to: stub });

		class A {
			constructor(public dep = inject(Dep)) {}
		}
		class B {
			constructor(public dep = inject(Dep)) {}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		expect(container.get(A).dep.name).toBe("contextual");

		expect(container.get(B).dep.name).toBe("stub");
	});

	test("contextually bound instances are not unnecessarily recreated", () => {
		const otherDep = createTypeToken();

		class A {
			constructor(public dep = inject(otherDep)) {}
		}

		container.bind(Dep, { instance: new Dep(), lifecycle: "singleton" });
		container.bind(otherDep, { instance: "other", lifecycle: "singleton" });

		expect(Dep.instantiations).toBe(1);

		container.when(A).needs(otherDep).give(Dep);

		container.get(A);
		container.get(A);

		expect(Dep.instantiations).toBe(1);
	});

	test("container can inject simple variable", () => {
		const numberToken = createTypeToken<number>();

		class A {
			constructor(public number = inject(numberToken)) {}
		}
		container
			.when(A)
			.needs(numberToken)
			.create(() => 100);

		const instance = container.get(A);
		expect(instance.number).toBe(100);
	});

	test("contextual binding works with aliased targets", () => {
		container.bind(Dep, { factory: () => new Dep("bound") });
		const alias = createTypeToken<Dep>("alias");
		container.alias({ from: alias, to: IDep });

		class A {
			constructor(public dep = inject(IDep)) {}
		}
		class B {
			constructor(public dep = inject(IDep)) {}
		}

		container
			.when(A)
			.needs(alias)
			.create(() => new Dep("via alias"));
		container.when(B).needs(alias).give(Dep);

		expect(container.get(A).dep.name).toBe("via alias");
		expect(container.get(B).dep.name).toBe("bound");
	});

	test("contextual binding works for invoke()", () => {
		class A {
			f(arg = inject(Dep)) {
				return arg.name;
			}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		const result = container.invoke(new A(), "f");
		expect(result).toBe("contextual");
	});

	test("contextual binding works for construct()", () => {
		class A {
			constructor(
				public mandatory: string,
				public injected = inject(Dep),
			) {}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		const result = container.construct(A, "mandatory-value");
		expect(result.mandatory).toBe("mandatory-value");
		expect(result.injected.name).toBe("contextual");
	});

	test("contextual binding matches stored class when factory is used", () => {
		interface ILogger {
			log(msg: string): void;
		}
		const ILogger = createTypeToken<ILogger>("ILogger");

		class ConsoleLogger implements ILogger {
			constructor(public config: string) {}
			log(_msg: string): void {
				// no-op for test
			}
		}

		class MyService {
			constructor(public logger = inject(ILogger)) {}
		}

		// Bind interface to class with factory
		container.bind(ILogger, {
			class: ConsoleLogger,
			factory: () => new ConsoleLogger("default"),
		});

		// Contextual override using the stored class
		container
			.when(MyService)
			.needs(ConsoleLogger)
			.create(() => new ConsoleLogger("custom"));

		const service = container.get(MyService);
		expect(service.logger).toBeInstanceOf(ConsoleLogger);
		expect((service.logger as ConsoleLogger).config).toBe("custom");
	});

	test("contextual binding matches alias to stored class when factory is used", () => {
		interface ILogger {
			log(msg: string): void;
		}
		const ILogger = createTypeToken<ILogger>();

		class ConsoleLogger implements ILogger {
			constructor(public config: string) {}
			log(_msg: string): void {
				// no-op for test
			}
		}

		const aliasToConsoleLogger = createTypeToken<ConsoleLogger>();

		class MyService {
			constructor(public logger = inject(ILogger)) {}
		}

		// Bind interface to class with factory
		container.bind(ILogger, {
			class: ConsoleLogger,
			factory: () => new ConsoleLogger("default"),
		});

		container.alias({ from: aliasToConsoleLogger, to: ConsoleLogger });

		// Contextual override using the stored class
		container
			.when(MyService)
			.needs(aliasToConsoleLogger)
			.create(() => new ConsoleLogger("custom"));

		const service = container.get(MyService);
		expect(service.logger).toBeInstanceOf(ConsoleLogger);
		expect((service.logger as ConsoleLogger).config).toBe("custom");
	});
});

describe("Container tagging", () => {
	test("container tags", () => {
		class A {}
		class B {}
		const foo = createTypeToken("foo");
		const bar = createTypeToken("bar");

		container.tag(A, [foo, bar]);
		container.tag(B, [foo]);

		const fooResults = [...container.tagged(foo)];

		const barResults = [...container.tagged(bar)];

		expect(fooResults).toHaveLength(2);
		expect(fooResults[0]).toBeInstanceOf(A);
		expect(fooResults[1]).toBeInstanceOf(B);
		expect(barResults).toHaveLength(1);
		expect(barResults[0]).toBeInstanceOf(A);

		const container2 = new ContainerImpl();
		container2.tag([A, B], [foo]);

		const fooResults2 = [...container2.tagged(foo)];
		expect(fooResults2).toHaveLength(2);
		expect(fooResults2[0]).toBeInstanceOf(A);
		expect(fooResults2[1]).toBeInstanceOf(B);

		expect([...container2.tagged(bar)]).toHaveLength(0);
	});

	test("tagged services are lazy loaded", () => {
		class A extends Dep {}
		class B extends Dep {}

		const foo = createTypeToken("foo");

		container.tag(A, foo);
		container.tag(B, foo);

		const iterator = container.tagged(foo);

		expect(Dep.instantiations).toBe(0);
		expect(iterator.next().value).toBeInstanceOf(A);
		expect(Dep.instantiations).toBe(1);
		expect(iterator.next().value).toBeInstanceOf(B);
		expect(Dep.instantiations).toBe(2);
		expect(iterator.next().done).toBe(true);
	});

	test("tagged services can be converted to array", () => {
		class A extends Dep {}
		class B extends Dep {}

		const foo = createTypeToken("foo");

		container.tag(A, foo);
		container.tag(B, foo);

		const from = Array.from(container.tagged(foo));
		expect(from).toHaveLength(2);
		expect(from[0]).toBeInstanceOf(A);
		expect(from[1]).toBeInstanceOf(B);

		const spread = [...container.tagged(foo)];
		expect(spread).toHaveLength(2);
		expect(spread[0]).toBeInstanceOf(A);
		expect(spread[1]).toBeInstanceOf(B);
	});

	test("lazy loaded tagged services can be looped over", () => {
		class A extends Dep {}
		class B extends Dep {}

		const foo = createTypeToken("foo");

		container.tag(A, foo);
		container.tag(B, foo);

		const iter = container.tagged(foo);
		let count = 0;
		for (const _ of iter) {
			++count;
		}
		expect(count).toBe(2);
	});
});

describe("Container extend", () => {
	test("extended bindings", () => {
		const fooKey = createTypeToken<string>("foo");
		container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });
		container.extend(fooKey, (old) => {
			return `${old} extended`;
		});

		expect(container.get(fooKey)).toBe("foo extended");

		const container2 = new ContainerImpl();
		const objKey = createTypeToken<{ name: string; age?: number }>("obj");

		container2.bind(objKey, {
			factory: () => {
				return { name: "Bernie" };
			},
			lifecycle: "singleton",
		});
		container2.extend(objKey, (old) => {
			old.age = 44;
			return old;
		});

		const result = container2.get(objKey);

		expect(result.name).toBe("Bernie");
		expect(result.age).toBe(44);
		expect(container2.get(objKey)).toBe(result);
	});

	test("extended bindings work with contextual overrides", () => {
		const fooKey = createTypeToken<string>("foo");
		container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });
		container.extend(fooKey, (old) => {
			return `${old} extended`;
		});

		class A {
			constructor(public foo = inject(fooKey)) {}

			m(foo = inject(fooKey)) {
				return foo;
			}
		}

		container
			.when(A)
			.needs(fooKey)
			.create(() => "bar");

		expect(container.get(A).foo).toBe("bar extended");
		expect(container.invoke(new A(""), "m")).toBe("bar extended");
	});

	test("extend instances are preserved", () => {
		type T = Record<string, string>;

		const fooKey = createTypeToken<T>("foo");
		container.bind(fooKey, {
			factory: () => {
				const obj: T = {};
				obj.foo = "bar";
				return obj;
			},
		});

		const obj: T = {};
		obj.foo = "foo";
		container.bind(fooKey, { instance: obj, lifecycle: "singleton" });
		container.extend(fooKey, (obj) => {
			obj.bar = "baz";
			return obj;
		});
		container.extend(fooKey, (obj) => {
			obj.baz = "foo";
			return obj;
		});

		expect(container.get(fooKey).foo).toBe("foo");
		expect(container.get(fooKey).bar).toBe("baz");
		expect(container.get(fooKey).baz).toBe("foo");
	});

	test("extend is lazy initialized", () => {
		class Lazy {
			static initialized = false;
			init() {
				Lazy.initialized = true;
			}
		}

		Lazy.initialized = false;

		container.bind(Lazy);
		container.extend(Lazy, (obj) => {
			obj.init();
			return obj;
		});
		expect(Lazy.initialized).toBe(false);
		container.get(Lazy);
		expect(Lazy.initialized).toBe(true);
	});

	test("extend can be called before bind", () => {
		const fooKey = createTypeToken<string>("foo");
		container.extend(fooKey, (old) => {
			return `${old} bar`;
		});
		container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });

		expect(container.get(fooKey)).toBe("foo bar");
	});

	test("extend instance rebinding callback", () => {
		let testRebind = false;

		const fooKey = createTypeToken<object>("foo");
		container.onRebinding(fooKey, () => {
			testRebind = true;
		});

		const obj = {};
		container.bind(fooKey, { instance: obj, lifecycle: "singleton" });

		container.extend(fooKey, (obj) => {
			return obj;
		});

		expect(testRebind).toBe(true);
	});

	test("can extend transient with null", () => {
		const token = createTypeToken<string | null>();
		container.bind(token, { instance: "hello" });
		expect(container.get(token)).toBe("hello");
		container.extend(token, () => null);
		expect(container.get(token)).toBe(null);
	});

	test("can extend singleton with null", () => {
		const token = createTypeToken<string | null>();
		const factory = mock(() => "hello");
		container.bind(token, { factory, lifecycle: "singleton" });
		expect(container.get(token)).toBe("hello");
		expect(container.get(token)).toBe("hello");
		expect(factory).toHaveBeenCalledTimes(1);
		const extender = mock(() => null);
		container.extend(token, extender);
		expect(container.get(token)).toBe(null);
		expect(container.get(token)).toBe(null);
		expect(factory).toHaveBeenCalledTimes(1);
		expect(extender).toHaveBeenCalledTimes(1);
	});

	test("extend bind rebinding callback", () => {
		let testRebind = false;

		const fooKey = createTypeToken<object>("foo");
		container.onRebinding(fooKey, () => {
			testRebind = true;
		});
		container.bind(fooKey, {
			factory: () => {
				return {};
			},
		});

		expect(testRebind).toBe(false);

		container.get(fooKey);

		container.extend(fooKey, (obj) => {
			return obj;
		});

		expect(testRebind).toBe(true);
	});

	test("extension works on aliased bindings", () => {
		const somethingKey = createTypeToken<string>();
		const aliasKey = createTypeToken<string>();
		container.bind(somethingKey, {
			factory: () => {
				return "some value";
			},
			lifecycle: "singleton",
		});
		container.alias({ from: aliasKey, to: somethingKey });
		container.extend(aliasKey, (value) => {
			return `${value} extended`;
		});

		expect(container.get(somethingKey)).toBe("some value extended");
	});

	test("extension works on binding that will be aliased later", () => {
		const somethingKey = createTypeToken<string>();
		const aliasKey = createTypeToken<string>();
		container.bind(somethingKey, {
			factory: () => {
				return "some value";
			},
			lifecycle: "singleton",
		});
		container.extend(aliasKey, (value) => {
			return `${value} extended`;
		});
		container.alias({ from: aliasKey, to: somethingKey });

		expect(container.get(somethingKey)).toBe("some value extended");
	});

	test("extension works on binding that will be deeply aliased later", () => {
		const somethingKey = createTypeToken();
		const aliasKey = createTypeToken();
		const deepAliasKey = createTypeToken();
		container.bind(somethingKey, {
			factory: () => {
				return "some value";
			},
			lifecycle: "singleton",
		});
		container.extend(deepAliasKey, (value) => {
			return `${String(value)} extended`;
		});
		container.alias({ from: aliasKey, to: somethingKey });
		container.alias({ from: deepAliasKey, to: aliasKey });

		expect(container.get(somethingKey)).toBe("some value extended");
	});

	test("multiple extends", () => {
		const fooKey = createTypeToken<string>("foo");
		container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });
		container.extend(fooKey, (old) => {
			return `${old} bar`;
		});
		container.extend(fooKey, (old) => {
			return `${old} baz`;
		});

		expect(container.get(fooKey)).toBe("foo bar baz");
	});

	test("extend contextual binding", () => {
		class A {
			constructor(public dep = inject(Dep)) {}
		}
		class AltDep {
			constructor(public name = "alt-default") {}
		}

		container.when(A).needs(Dep).give(AltDep);

		container.extend(AltDep, (instance) => {
			return new AltDep(`extended ${instance.name}`);
		});

		expect(container.get(A).dep.name).toBe("extended alt-default");
	});

	test("extend contextual binding after resolution", () => {
		interface I {
			value: string;
		}
		const I = createTypeToken<I>("I");
		class Impl implements I {
			constructor(public value: string) {}
		}
		class Consumer {
			constructor(public stub = inject(I)) {}
		}

		container
			.when(Consumer)
			.needs(I)
			.create(() => new Impl("foo"));

		container.get(Consumer);

		container.extend(I, (instance) => {
			expect(instance).toBeInstanceOf(Impl);
			expect(instance.value).toBe("foo");

			return new Impl("bar");
		});

		expect(container.get(Consumer).stub.value).toBe("bar");
	});
});

describe("Container resolving callbacks", () => {
	test("resolving callbacks are called for classes", () => {
		const callback = mock();
		container.onResolving(Dep, callback);
		const dep = new Dep("hello");
		container.bind(Dep, { factory: () => dep });

		container.get(Dep);
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenLastCalledWith(dep, container);
		container.get(Dep);
		expect(callback).toHaveBeenCalledTimes(2);
	});

	test("resolving callbacks are called for tokens", () => {
		const token = createTypeToken<string>();
		const callback = mock();
		container.onResolving(token, callback);
		container.bind(token, { factory: () => "hello" });
		container.get(token);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenLastCalledWith("hello", container);
	});

	test("resolving callbacks are not called for other abstracts", () => {
		class Other {
			name?: string;
		}
		const token = createTypeToken<Dep>();
		const callback = mock();
		container.onResolving(Other, callback);
		container.bind(token, { factory: () => new Dep("hello") });
		container.get(token);

		expect(callback).not.toHaveBeenCalled();
	});

	test("resolving callbacks are called for type", () => {
		class A {}
		const token = createTypeToken();
		const callback = mock();
		container.onResolving(A, callback);
		container.bind(token, { factory: () => new A() });

		container.get(token);
		expect(callback).toHaveBeenCalledTimes(1);
		container.get(token);
		expect(callback).toHaveBeenCalledTimes(2);
	});

	test("resolving callbacks are called for parent types", () => {
		class Parent {}
		class Child extends Parent {}
		const token = createTypeToken();
		const callback = mock();
		container.onResolving(Parent, callback);
		container.bind(token, { factory: () => new Child() });

		container.get(token);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks on Object are called for any instance", () => {
		class A {}
		const token = createTypeToken();
		const callback = mock();
		container.onResolving(Object, callback);
		container.bind(token, { factory: () => new A() });

		container.get(token);

		expect(callback).toHaveBeenCalledTimes(1);

		// not called for null prototype objects
		container.bind(token, { factory: () => Object.create(null) });
		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are not called for child types", () => {
		class Parent {}
		class Child extends Parent {}
		const token = createTypeToken();
		const callback = mock();
		container.onResolving(Child, callback);
		container.bind(token, { factory: () => new Parent() });

		container.get(token);

		expect(callback).toHaveBeenCalledTimes(0);
	});

	test("resolving callbacks are called once for singleton concretes", () => {
		const depKey = createTypeToken<Dep>();
		const depCallback = mock();
		const keyCallback = mock();
		container.onResolving(Dep, depCallback);
		container.onResolving(depKey, keyCallback);

		container.bind(depKey, { factory: () => new Dep() });
		container.bind(Dep);

		container.get(depKey);
		expect(depCallback).toHaveBeenCalledTimes(1);
		expect(keyCallback).toHaveBeenCalledTimes(1);

		container.get(Dep);
		expect(depCallback).toHaveBeenCalledTimes(2);
		expect(keyCallback).toHaveBeenCalledTimes(1);

		container.get(Dep);
		expect(depCallback).toHaveBeenCalledTimes(3);
		expect(keyCallback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks can still be added after the first resolution", () => {
		container.bind(Dep);
		container.get(Dep);

		const callback = mock();
		container.onResolving(Dep, callback);

		container.get(Dep);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called when rebind happens", () => {
		const token = createTypeToken<Dep>();

		const resolvingCallback = mock();
		container.onResolving(token, resolvingCallback);
		const rebindingCallback = mock();
		container.onRebinding(token, rebindingCallback);

		container.bind(token, { factory: () => new Dep("A") });

		container.get(token);

		expect(resolvingCallback).toHaveBeenCalledTimes(1);
		expect(rebindingCallback).toHaveBeenCalledTimes(0);

		container.bind(token, { factory: () => new Dep("B") });
		expect(resolvingCallback).toHaveBeenCalledTimes(2);
		expect(rebindingCallback).toHaveBeenCalledTimes(1);

		container.get(token);
		expect(resolvingCallback).toHaveBeenCalledTimes(3);
		expect(rebindingCallback).toHaveBeenCalledTimes(1);

		container.bind(token, { factory: () => new Dep("C") });
		expect(resolvingCallback).toHaveBeenCalledTimes(4);
		expect(rebindingCallback).toHaveBeenCalledTimes(2);
	});

	test("resolving callbacks aren't called when no re-bindings are registered", () => {
		const token = createTypeToken<Dep>();

		const resolvingCallback = mock();
		container.onResolving(token, resolvingCallback);

		container.bind(token, { factory: () => new Dep("A") });

		container.get(token);

		expect(resolvingCallback).toHaveBeenCalledTimes(1);

		container.bind(token, { factory: () => new Dep("B") });
		expect(resolvingCallback).toHaveBeenCalledTimes(1);

		container.get(token);
		expect(resolvingCallback).toHaveBeenCalledTimes(2);

		container.bind(token, { factory: () => new Dep("C") });
		expect(resolvingCallback).toHaveBeenCalledTimes(2);

		container.get(token);
		expect(resolvingCallback).toHaveBeenCalledTimes(3);
	});

	test("rebinding does not affect multiple resolving callbacks", () => {
		class A {}
		class B extends A {}
		class C {}
		const callback = mock();

		container.onResolving(A, callback);
		container.onResolving(B, callback);

		container.bind(A);

		// it should call the callback for interface
		container.get(A);
		expect(callback).toHaveBeenCalledTimes(1);

		container.bind(A, { factory: () => new C() });

		// it should call the callback for interface
		container.get(A);
		expect(callback).toHaveBeenCalledTimes(2);

		// should call the callback for the interface it implements
		// plus the callback for ResolvingImplementationStubTwo.
		container.get(B);
		expect(callback).toHaveBeenCalledTimes(4);
	});

	test("resolving callbacks are called for parent and child classes when a child is made", () => {
		class Parent {}
		class Child extends Parent {}

		const childCallback = mock();
		const parentCallback = mock();
		container.onResolving(Child, childCallback);
		container.onResolving(Parent, parentCallback);

		container.bind(Child, { factory: () => new Child() });

		container.get(Child);

		expect(childCallback).toHaveBeenCalledTimes(1);
		expect(parentCallback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called for parent and child classes when a parent is made providing an instance of the child", () => {
		class Parent {}
		class Child extends Parent {}

		const childCallback = mock();
		const parentCallback = mock();
		container.onResolving(Child, childCallback);
		container.onResolving(Parent, parentCallback);

		container.bind(Parent, { factory: () => new Child() });

		container.get(Parent);

		expect(childCallback).toHaveBeenCalledTimes(1);
		expect(parentCallback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called for parent class and not child class when a parent is made", () => {
		class Parent {}
		class Child extends Parent {}

		const childCallback = mock();
		const parentCallback = mock();
		container.onResolving(Child, childCallback);
		container.onResolving(Parent, parentCallback);

		container.bind(Parent, { factory: () => new Parent() });

		container.get(Parent);

		expect(childCallback).toHaveBeenCalledTimes(0);
		expect(parentCallback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called for concretes when attached on concretes", () => {
		class A {}
		class B {}

		const aCallback = mock();
		const bCallback = mock();
		container.onResolving(A, aCallback);
		container.onResolving(B, bCallback);

		container.bind(A, { factory: () => new B() });

		container.get(A);

		expect(aCallback).toHaveBeenCalledTimes(1);
		expect(bCallback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called for concretes with no binding", () => {
		class A {}

		const callback = mock();
		container.onResolving(A, callback);

		container.get(A);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called for keys with no binding injected contextually", () => {
		const token = createTypeToken();

		class A {
			constructor(public dep = inject(token)) {}
		}

		container
			.when(A)
			.needs(token)
			.create(() => "hello");

		const callback = mock();
		container.onResolving(token, callback);

		container.get(A);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	test("resolving callbacks are called for classes with no binding injected contextually", () => {
		class B {}
		class C {}

		class A {
			constructor(public dep = inject(B)) {}
		}

		container
			.when(A)
			.needs(B)
			.create(() => new C());

		const aCallback = mock();
		container.onResolving(A, aCallback);
		const bCallback = mock();
		container.onResolving(B, bCallback);
		const cCallback = mock();
		container.onResolving(C, cCallback);

		container.get(A);

		expect(aCallback).toHaveBeenCalledTimes(1);
		expect(bCallback).toHaveBeenCalledTimes(1);
		expect(cCallback).toHaveBeenCalledTimes(1);
	});
});

describe("Container withScope", () => {
	test("withScope returns same value as synchronous callback", () => {
		const result = container.withScope(() => {
			return 4;
		});

		expectTypeOf(result).toBeNumber();

		expect(result).toBe(4);
	});

	test("withScope returns same value as asynchronous callback", async () => {
		const result = container.withScope(async () => {
			return 4;
		});

		expectTypeOf(result).toEqualTypeOf<Promise<number>>();

		expect(await result).toBe(4);
	});

	test("scoped type token resolution throws outside scope", () => {
		const token = createTypeToken("token");
		container.bind(token, {
			factory: () => {
				return {};
			},
			lifecycle: "scoped",
		});
		expect(() => container.get(token)).toThrowErrorMatchingInlineSnapshot(
			`"Cannot create [token] because it is scoped so can only be accessed within a request"`,
		);
	});

	test("scoped class reference resolution throws outside scope", () => {
		class Foo {}
		container.scoped(Foo);
		expect(() => container.get(Foo)).toThrowErrorMatchingInlineSnapshot(
			`"Cannot create [Foo] because it is scoped so can only be accessed within a request"`,
		);
	});

	test("scoped bindings work within withScope", async () => {
		class Database {}
		container.scoped(Database);

		expect(container.getLifecycle(Database)).toBe("scoped");

		const result = await container.withScope(async () => {
			const db1 = container.get(Database);
			const db2 = container.get(Database);
			expect(db1).toBe(db2); // Same instance within scope
			return db1;
		});

		expect(result).toBeInstanceOf(Database);
	});

	test("scoped bindings work with contextual bindings", async () => {
		class Database {
			constructor(public dep = inject(Dep)) {}
		}
		container.scoped(Database);

		container
			.when(Database)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		const result = await container.withScope(async () => {
			const db1 = container.get(Database);
			const db2 = container.get(Database);
			expect(db1).toBe(db2); // Same instance within scope
			expect(db1.dep.name).toBe("contextual");
			return db1;
		});

		expect(result).toBeInstanceOf(Database);
	});

	test("different scopes get different instances", async () => {
		class Database {}
		container.scoped(Database);

		const [db1, db2] = await Promise.all([
			container.withScope(async () => container.get(Database)),
			container.withScope(async () => container.get(Database)),
		]);

		expect(db1).not.toBe(db2);
	});

	test("nested scopes are isolated", async () => {
		class Database {}
		container.scoped(Database);

		await container.withScope(async () => {
			const outerDb = container.get(Database);

			await container.withScope(async () => {
				const innerDb = container.get(Database);
				expect(innerDb).not.toBe(outerDb); // Different scope
			});

			const outerDb2 = container.get(Database);
			expect(outerDb2).toBe(outerDb); // Same scope
		});
	});

	test("hasScope property indicates whether container is in a scope", async () => {
		expect(container.hasScope).toBe(false);

		let hasBeenInScope = false;

		await container.withScope(async () => {
			expect(container.hasScope).toBe(true);
			await Promise.resolve();
			hasBeenInScope = true;
			expect(container.hasScope).toBe(true);
		});

		expect(container.hasScope).toBe(false);

		expect(hasBeenInScope).toBe(true);
	});

	test("scoped instances are different in different scopes", async () => {
		let idCounter = 0;
		class Database {
			id: number;
			constructor() {
				this.id = ++idCounter;
			}
		}
		container.scoped(Database);

		const [db1, db2] = await Promise.all([
			container.withScope(() => container.get(Database)),
			container.withScope(() => container.get(Database)),
		]);

		expect(db1).not.toBe(db2);
		expect(db1.id).not.toBe(db2.id);
	});

	test("scope propagates through async function calls", async () => {
		class Logger {
			logs: string[] = [];
		}
		container.scoped(Logger);

		async function doWork(message: string) {
			const logger = container.get(Logger);
			logger.logs.push(message);
			await Promise.resolve();
			return logger;
		}

		await container.withScope(async () => {
			const logger1 = await doWork("first");
			const logger2 = await doWork("second");

			expect(logger1).toBe(logger2);
			expect(logger1.logs).toEqual(["first", "second"]);
		});
	});

	test("same scope returns same instance across different async operations", async () => {
		class Logger {
			logs: string[] = [];
		}
		container.scoped(Logger);

		await container.withScope(async () => {
			const logger1 = container.get(Logger);
			logger1.logs.push("first");

			await Promise.resolve();

			// Critical test: AsyncLocalStorage context should survive setTimeout
			await new Promise<void>((resolve) => {
				setTimeout(() => {
					const logger2 = container.get(Logger);
					logger2.logs.push("second");

					expect(logger2).toBe(logger1);
					resolve();
				}, 0);
			});

			const logger3 = container.get(Logger);
			logger3.logs.push("third");
			expect(logger1).toBe(logger3);
			expect(logger1.logs).toEqual(["first", "second", "third"]);
		});
	});

	test("scoped instances are isolated even when scopes overlap", async () => {
		const scope1Hold = asyncGate();
		const scope2Created = asyncGate();

		class Database {
			id: number;
			constructor() {
				this.id = ++idCounter;
			}
		}
		let idCounter = 0;
		container.scoped(Database);

		let db1: Database | undefined;
		let db2: Database | undefined;

		const task1 = container.withScope(async () => {
			db1 = container.get(Database);
			await scope1Hold.block();
			return db1;
		});

		const task2 = container.withScope(async () => {
			await scope2Created.block();
			db2 = container.get(Database);
			return db2;
		});

		await scope1Hold.hasBlocked();
		await scope2Created.hasBlocked();

		// Release scope2 first - it creates db2 while scope1 is still active
		scope2Created.release();
		await task2;

		expect(db1).not.toBe(db2);

		// Now let scope1 finish
		scope1Hold.release();
		await task1;
	});
});

describe("Container currentlyInScope", () => {
	test("returns null when not in a scope", () => {
		expect(ContainerImpl.currentlyInScope()).toBe(null);
	});

	test("returns container when inside a scope", () => {
		container.withScope(() => {
			expect(ContainerImpl.currentlyInScope()).toBe(container);
		});
	});

	test("returns null after scope exits", () => {
		container.withScope(() => {
			expect(ContainerImpl.currentlyInScope()).toBe(container);
		});

		expect(ContainerImpl.currentlyInScope()).toBe(null);
	});

	test("returns container across async operations within scope", async () => {
		await container.withScope(async () => {
			expect(ContainerImpl.currentlyInScope()).toBe(container);

			await Promise.resolve();
			expect(ContainerImpl.currentlyInScope()).toBe(container);

			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(ContainerImpl.currentlyInScope()).toBe(container);
		});
	});

	test("nested scopes return same container", async () => {
		await container.withScope(async () => {
			const outer = ContainerImpl.currentlyInScope();
			expect(outer).toBe(container);

			await container.withScope(async () => {
				const inner = ContainerImpl.currentlyInScope();
				expect(inner).toBe(container);
				expect(inner).toBe(outer); // Same container instance
			});

			expect(ContainerImpl.currentlyInScope()).toBe(container);
		});
	});

	test("concurrent scopes return correct container", async () => {
		const container1 = new ContainerImpl();
		const container2 = new ContainerImpl();

		const [result1, result2] = await Promise.all([
			container1.withScope(() => ContainerImpl.currentlyInScope()),
			container2.withScope(() => ContainerImpl.currentlyInScope()),
		]);

		expect(result1).toBe(container1);
		expect(result2).toBe(container2);
	});
});

describe("Scoped instances", () => {
	test("scoped instance throws when accessed outside scope", () => {
		class Foo {}
		container.withScope(() => {
			container.scopedInstance(Foo, new Foo());
		});

		expect(() => container.get(Foo)).toThrowErrorMatchingInlineSnapshot(
			`"Cannot create [Foo] because it is scoped so can only be accessed within a request"`,
		);
	});

	test("scoped instance works within withScope", async () => {
		class Foo {}
		const instance = new Foo();

		await container.withScope(async () => {
			container.scopedInstance(Foo, instance);
			const foo1 = container.get(Foo);
			const foo2 = container.get(Foo);
			expect(foo1).toBe(instance);
			expect(foo2).toBe(instance);
			expect(foo1).toBe(foo2);
		});
	});

	test("different scopes get different scoped instances", async () => {
		class Foo {}
		const instance1 = new Foo();
		const instance2 = new Foo();

		const [result1, result2] = await Promise.all([
			container.withScope(async () => {
				container.scopedInstance(Foo, instance1);
				return container.get(Foo);
			}),
			container.withScope(async () => {
				container.scopedInstance(Foo, instance2);
				return container.get(Foo);
			}),
		]);

		expect(result1).toBe(instance1);
		expect(result2).toBe(instance2);
		expect(result1).not.toBe(result2);
	});

	test("extend can be called before binding scoped instance", async () => {
		type T = { value: string; extended?: string };
		const token = createTypeToken<T>("token");

		container.extend(token, (obj) => {
			obj.extended = "yes";
			return obj;
		});

		await container.withScope(async () => {
			container.scopedInstance(token, { value: "original" });
			const result = container.get(token);
			expect(result.value).toBe("original");
			expect(result.extended).toBe("yes");
		});
	});

	test("extend scoped instance applies immediately when bound", async () => {
		type T = { value: string; extended?: string };
		const token = createTypeToken<T>("token");

		await container.withScope(async () => {
			container.scopedInstance(token, { value: "original" });

			container.extend(token, (obj) => {
				obj.extended = "yes";
				return obj;
			});

			const result = container.get(token);
			expect(result.value).toBe("original");
			expect(result.extended).toBe("yes");
		});
	});

	test("extend scoped instance rebinding callback", async () => {
		let testRebind = false;
		const token = createTypeToken<object>("token");

		container.onRebinding(token, () => {
			testRebind = true;
		});

		await container.withScope(async () => {
			container.scopedInstance(token, {});

			container.extend(token, (obj) => obj);

			expect(testRebind).toBe(true);
		});
	});

	test("contextual binding works with scoped instance bindings", async () => {
		container.bind(Dep, { instance: new Dep("instance"), lifecycle: "singleton" });

		class A {
			constructor(public dep = inject(Dep)) {}
		}

		container
			.when(A)
			.needs(Dep)
			.create(() => new Dep("contextual"));

		await container.withScope(async () => {
			// Bind A with scoped lifecycle (not instance, just scoped class)
			container.scoped(A);

			// When we get A, it should use contextual Dep
			expect(container.get(A).dep.name).toBe("contextual");
		});
	});
});

describe("Container sugar methods", () => {
	let bindSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		bindSpy = spyOn(container, "bind");
	});

	test("bind(key, cls) delegates to bind", () => {
		container.bind(IDep, Dep);
		expect(bindSpy).toHaveBeenCalledWith(IDep, { class: Dep });
	});

	test("bindIf(cls) delegates to bind", () => {
		container.bindIf(Dep);
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			class: Dep,
			lifecycle: "transient",
			ifNotBound: true,
		});
	});

	test("bindIf(key, cls) delegates to bind", () => {
		container.bindIf(IDep, Dep);
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			class: Dep,
			lifecycle: "transient",
			ifNotBound: true,
		});
	});

	test("singleton(cls) delegates to bind", () => {
		container.singleton(Dep);
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			class: Dep,
			lifecycle: "singleton",
			ifNotBound: false,
		});
	});

	test("singleton(key, cls) delegates to bind", () => {
		container.singleton(IDep, Dep);
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			class: Dep,
			lifecycle: "singleton",
			ifNotBound: false,
		});
	});

	test("singletonIf(cls) delegates to bind", () => {
		container.singletonIf(Dep);
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			class: Dep,
			lifecycle: "singleton",
			ifNotBound: true,
		});
	});

	test("singletonIf(key, cls) delegates to bind", () => {
		container.singletonIf(IDep, Dep);
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			class: Dep,
			lifecycle: "singleton",
			ifNotBound: true,
		});
	});

	test("scoped(cls) delegates to bind", () => {
		container.scoped(Dep);
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			class: Dep,
			lifecycle: "scoped",
			ifNotBound: false,
		});
	});

	test("scoped(key, cls) delegates to bind", () => {
		container.scoped(IDep, Dep);
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			class: Dep,
			lifecycle: "scoped",
			ifNotBound: false,
		});
	});

	test("scopedIf(cls) delegates to bind", () => {
		container.scopedIf(Dep);
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			class: Dep,
			lifecycle: "scoped",
			ifNotBound: true,
		});
	});

	test("scopedIf(key, cls) delegates to bind", () => {
		container.scopedIf(IDep, Dep);
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			class: Dep,
			lifecycle: "scoped",
			ifNotBound: true,
		});
	});

	test("singletonInstance(cls, obj) delegates to bind", () => {
		const obj = new Dep();
		container.singletonInstance(Dep, obj);
		expect(bindSpy).toHaveBeenCalledWith(Dep, { instance: obj });
	});

	test("singletonInstance(key, obj) delegates to bind", () => {
		const obj = new Dep();
		container.singletonInstance(IDep, obj);
		expect(bindSpy).toHaveBeenCalledWith(IDep, { instance: obj });
	});

	test("singletonInstanceIf(cls, obj) delegates to bind", () => {
		const obj = new Dep();
		container.singletonInstanceIf(Dep, obj);
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			instance: obj,
			ifNotBound: true,
		});
	});

	test("singletonInstanceIf(key, obj) delegates to bind", () => {
		const obj = new Dep();
		container.singletonInstanceIf(IDep, obj);
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			instance: obj,
			ifNotBound: true,
		});
	});

	test("scopedInstance(cls, obj) delegates to bind", () => {
		const obj = new Dep();
		container.withScope(() => {
			container.scopedInstance(Dep, obj);
		});
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			instance: obj,
			lifecycle: "scoped",
		});
	});

	test("scopedInstance(key, obj) delegates to bind", () => {
		const obj = new Dep();
		container.withScope(() => {
			container.scopedInstance(IDep, obj);
		});
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			instance: obj,
			lifecycle: "scoped",
		});
	});

	test("scopedInstanceIf(cls, obj) delegates to bind", () => {
		const obj = new Dep();
		container.withScope(() => {
			container.scopedInstanceIf(Dep, obj);
		});
		expect(bindSpy).toHaveBeenCalledWith(Dep, {
			instance: obj,
			ifNotBound: true,
			lifecycle: "scoped",
		});
	});

	test("scopedInstanceIf(key, obj) delegates to bind", () => {
		const obj = new Dep();
		container.withScope(() => {
			container.scopedInstanceIf(IDep, obj);
		});
		expect(bindSpy).toHaveBeenCalledWith(IDep, {
			instance: obj,
			ifNotBound: true,
			lifecycle: "scoped",
		});
	});
});

// shared dependency class
class Dep implements IDep {
	static instantiations = 0;
	constructor(public name = "default") {
		++Dep.instantiations;
	}
}

interface IDep {
	get name(): string;
}
const IDep = createTypeToken<IDep>("IDep");
