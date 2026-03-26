import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { resolve } from "path";

setDefaultTimeout(30_000);

const PORT = 3457;
const BASE_URL = `http://localhost:${PORT}`;
let serverProcess: ReturnType<typeof Bun.spawn>;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			await fetch(url);
			return;
		} catch {
			await Bun.sleep(200);
		}
	}
	throw new Error(`Server not ready at ${url} after ${timeoutMs}ms`);
}

beforeAll(async () => {
	console.log("Starting Nitro dev server...");
	const projectRoot = resolve(import.meta.dir, "..");
	serverProcess = Bun.spawn(
		["node", resolve(projectRoot, "node_modules/.bin/nitro"), "dev", "--port", String(PORT)],
		{
			cwd: projectRoot,
			stdout: "inherit",
			stderr: "inherit",
		},
	);

	await waitForServer(BASE_URL, 20_000);
});

afterAll(() => {
	if (serverProcess) {
		serverProcess.kill();
	}
});

describe("Basic route", () => {
	test("hello endpoint returns expected response", async () => {
		const response = await fetch(`${BASE_URL}/aku/hello`);
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toBe("Hello from Aku on Nitro!");
	});
});

describe("Cookie API", () => {
	test("basic cookie flow: get empty, set, get, delete, get empty", async () => {
		// Get cookies - should be empty
		let response = await fetch(`${BASE_URL}/aku/api/cookies`);
		let data = await response.json();
		expect(data.cookies).toEqual({});

		// Set a cookie
		response = await fetch(`${BASE_URL}/aku/api/cookies`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "testCookie", value: "testValue" }),
		});
		data = await response.json();
		expect(data.success).toBe(true);
		expect(data.cookie.name).toBe("testCookie");
		expect(data.cookie.value).toBe("testValue");

		// Verify cookie is set by sending it back
		response = await fetch(`${BASE_URL}/aku/api/cookies`, {
			headers: { Cookie: "testCookie=testValue" },
		});
		data = await response.json();
		expect(data.cookies.testCookie).toBe("testValue");

		// Delete the cookie
		response = await fetch(`${BASE_URL}/aku/api/cookies/testCookie`, {
			method: "DELETE",
		});
		data = await response.json();
		expect(data.success).toBe(true);
		expect(data.deleted).toBe("testCookie");

		// Verify cookie is deleted (no cookie header sent)
		response = await fetch(`${BASE_URL}/aku/api/cookies`);
		data = await response.json();
		expect(data.cookies).toEqual({});
	});

	test("cookie options are properly set in Set-Cookie headers", async () => {
		const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "optionsCookie",
				value: "testValue",
				options: {
					path: "/aku",
					domain: "localhost",
					secure: true,
					httpOnly: true,
					maxAge: 3600,
					sameSite: "lax",
				},
			}),
		});

		const setCookieHeader = response.headers.get("set-cookie");
		expect(setCookieHeader).toBeTruthy();

		expect(setCookieHeader).toContain("optionsCookie=testValue");
		expect(setCookieHeader).toContain("Path=/aku");
		expect(setCookieHeader).toContain("Domain=localhost");
		expect(setCookieHeader).toContain("Secure");
		expect(setCookieHeader).toContain("HttpOnly");
		expect(setCookieHeader).toContain("Max-Age=3600");
		expect(setCookieHeader).toContain("SameSite=Lax");
	});

	test("sameSite strict option", async () => {
		const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "strictCookie",
				value: "value",
				options: { sameSite: "strict" },
			}),
		});

		const setCookieHeader = response.headers.get("set-cookie");
		expect(setCookieHeader).toContain("SameSite=Strict");
	});

	test("sameSite none option with secure", async () => {
		const response = await fetch(`${BASE_URL}/aku/api/cookies`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "noneCookie",
				value: "value",
				options: { sameSite: "none", secure: true },
			}),
		});

		const setCookieHeader = response.headers.get("set-cookie");
		expect(setCookieHeader).toContain("SameSite=None");
		expect(setCookieHeader).toContain("Secure");
	});
});

describe("Param API", () => {
	test("param decoding works with URL-encoded slashes", async () => {
		const response = await fetch(`${BASE_URL}/aku/api/param/either%2For/test`);
		const data = await response.json();
		expect(data.param).toBe("either/or");
	});

	test("param decoding works with multiple encoded characters", async () => {
		const response = await fetch(`${BASE_URL}/aku/api/param/hello%20world%2Ftest/test`);
		const data = await response.json();
		expect(data.param).toBe("hello world/test");
	});

	test("param decoding works with special characters", async () => {
		const response = await fetch(
			`${BASE_URL}/aku/api/param/${encodeURIComponent("foo?bar&baz=qux")}/test`,
		);
		const data = await response.json();
		expect(data.param).toBe("foo?bar&baz=qux");
	});
});
