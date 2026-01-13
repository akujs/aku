import { AkuEvent } from "../../../../core/core-events.ts";
import { BaseClass } from "../../../../utils.ts";

// Good: ends with Event and extends AkuEvent
export class GoodEvent extends AkuEvent {}

// Good: doesn't end with Event, extends BaseClass
export class RegularClass extends BaseClass {}

// Bad: ends with Event but doesn't extend AkuEvent
export class FooEvent extends BaseClass {}

// Bad: extends AkuEvent but doesn't end with Event
export class BadEventExtension extends AkuEvent {}
