import assert from "node:assert";
import { test } from "node:test";

import { createApplication } from "aku";
import { ContainerImpl } from "aku/container";

test("createApplication is defined", () => {
	assert.ok(createApplication !== undefined);
});

test("ContainerImpl is defined", () => {
	assert.ok(ContainerImpl !== undefined);
});
