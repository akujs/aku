import { BaseClass } from "../../../../utils.ts";

// Good: extends BaseClass
export class GoodClass extends BaseClass {}

// Bad: doesn't extend any required base class
export class Standalone {}
