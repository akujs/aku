import { BaseClass } from "../utils.ts";
import type { IClassListenerInstance } from "./contracts/Dispatcher.ts";

/**
 * Base class for event listeners.
 *
 * Class-based listeners are instantiated by the container when events are dispatched,
 * allowing them to receive dependencies via constructor injection.
 *
 * @example
 * class UserRegisteredListener extends BaseListener {
 *   constructor(private emailService = inject(EmailService)) {
 *     super();
 *   }
 *
 *   handle(event: UserRegistered): void {
 *     this.emailService.sendWelcome(event.user);
 *   }
 * }
 *
 * dispatcher.addListener(UserRegistered, UserRegisteredListener);
 */
export abstract class BaseListener extends BaseClass implements IClassListenerInstance<object> {
	static readonly isClassListener = true;

	abstract handle(event: object): void;
}
