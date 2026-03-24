import { AkuEvent } from "../../../../core/core-events.ts";
import { BaseClass } from "../../../../utils.ts";

// Good: ends with Event, extends AkuEvent, starts with module name
export class ErrorsGoodEvent extends AkuEvent {}

// Good: doesn't end with Event, extends BaseClass
export class RegularClass extends BaseClass {}

// Bad: ends with Event but doesn't extend AkuEvent
export class ErrorsFooEvent extends BaseClass {}

// Bad: extends AkuEvent but doesn't end with Event
export class BadEventExtension extends AkuEvent {}

// Bad: extends AkuEvent, ends with Event, but doesn't start with module name
export class BadPrefixEvent extends AkuEvent {}
