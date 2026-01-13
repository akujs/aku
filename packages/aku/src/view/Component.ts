import type { Key } from "../core/Key.ts";
import { createKey } from "../core/Key.ts";
import { BaseClass } from "../utils.ts";
import type { Context, JSX, Props } from "./view-types.ts";

/**
 * A Function Component
 */
export type FunctionComponent<P = Props> = {
	(props: P, context: Context): JSX.Element;
	displayName?: string | undefined;
};

/**
 * A class component - a component class that extends BaseComponent
 */
export type ClassComponent<P = Props> = (new (
	props: P,
) => IClassComponentInstance) & {
	isClassComponent: true;
};

/***/
export type Component<P = Props> = FunctionComponent<P> | ClassComponent<P>;

export type ComponentInstantiator = <P>(
	tag: Component<P>,
	props: P,
) => (ctx: Context) => JSX.Element;

export const ComponentInstantiator: Key<ComponentInstantiator | undefined> =
	createKey<ComponentInstantiator>({
		displayName: "ComponentInstantiator",
	});

export function isClassComponent(value: unknown): value is ClassComponent {
	return (
		typeof value === "function" && "isClassComponent" in value && value.isClassComponent === true
	);
}

interface IClassComponentInstance<P = Props> {
	props: P;
	render(context: Context): JSX.Element;
}

/**
 * Base class for components. All class-based components must either extend this
 * class or define a `static isClassComponent = true` member so that the
 * renderer recognises them as class components.
 *
 * @example
 * class MyComponent extends Component {
 *   render() {
 *     return <div>Hello, world!</div>;
 *   }
 * }
 */
export abstract class BaseComponent<P = Props>
	extends BaseClass
	implements IClassComponentInstance<P>
{
	static readonly isClassComponent = true;

	props: P;

	constructor(props: P) {
		super();
		this.props = props;
	}

	/**
	 * Render the component
	 *
	 * @param context - Render context
	 * @returns JSX element or Promise resolving to JSX element
	 */
	abstract render(context: Context): JSX.Element;
}
