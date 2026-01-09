import assert from "node:assert";
import { test } from "node:test";

import { createApplication } from "beynac";
import { ContainerImpl } from "beynac/container";

test("createApplication is defined", () => {
	assert.ok(createApplication !== undefined);
});

test("ContainerImpl is defined", () => {
	assert.ok(ContainerImpl !== undefined);
});
