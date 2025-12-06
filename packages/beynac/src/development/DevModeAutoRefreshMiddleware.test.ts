import { expect, mock, spyOn, test } from "bun:test";
import { controllerContext } from "../test-utils/http-test-utils.bun.ts";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware.ts";

test("calls next middleware for non-SSE requests", async () => {
	const middleware = new DevModeAutoRefreshMiddleware({});
	const next = mock(() => new Response("OK"));

	const ctx = controllerContext();
	await middleware.handle(ctx, next);

	expect(next).toHaveBeenCalledWith(ctx);
});

test("SSE endpoint returns correct headers", async () => {
	const middleware = new DevModeAutoRefreshMiddleware({});
	const next = mock(() => new Response("OK"));

	const response = await middleware.handle(
		controllerContext(new Request("http://example.com?__beynac_dev_mode_refresh")),
		next,
	);

	expect(next).not.toHaveBeenCalled();
	expect(response).toBeInstanceOf(Response);
	expect(response.headers.get("Content-Type")).toBe("text/event-stream");
	expect(response.headers.get("Cache-Control")).toBe("no-cache");
	expect(response.headers.get("Connection")).toBe("keep-alive");
});

test("injects script into HTML response before </body>", async () => {
	const middleware = new DevModeAutoRefreshMiddleware({});
	const html = "<html><body><h1>Test</h1></body></html>";
	const next = mock(
		() =>
			new Response(html, {
				headers: { "Content-Type": "text/html" },
			}),
	);

	const generateScriptSpy = spyOn(middleware as any, "generateScript");
	generateScriptSpy.mockReturnValue("<script>MARKER</script>");

	const response = await middleware.handle(controllerContext(), next);

	const result = await response.text();

	expect(result).toContain("<script>MARKER</script>");
	expect(result).toContain("<h1>Test</h1>");
	expect(result.indexOf("<script>MARKER</script>")).toBeLessThan(result.indexOf("</body>"));
});

test("injects script into HTML response before </html> if no </body>", async () => {
	const middleware = new DevModeAutoRefreshMiddleware({});
	const html = "<html><h1>Test</h1></html>";
	const next = mock(
		() =>
			new Response(html, {
				headers: { "Content-Type": "text/html" },
			}),
	);

	const generateScriptSpy = spyOn(middleware as any, "generateScript");
	generateScriptSpy.mockReturnValue("<script>MARKER</script>");

	const response = await middleware.handle(controllerContext(), next);

	const result = await response.text();

	expect(result).toContain("<script>MARKER</script>");
	expect(result).toContain("<h1>Test</h1>");
	expect(result.indexOf("<script>MARKER</script>")).toBeLessThan(result.indexOf("</html>"));
});

test("injects script at end if no closing tags found", async () => {
	const middleware = new DevModeAutoRefreshMiddleware({});
	const html = "<h1>Test</h1>";
	const next = mock(
		() =>
			new Response(html, {
				headers: { "Content-Type": "text/html" },
			}),
	);

	const generateScriptSpy = spyOn(middleware as any, "generateScript");
	generateScriptSpy.mockReturnValue("<script>MARKER</script>");

	const response = await middleware.handle(controllerContext(), next);

	const result = await response.text();

	expect(result).toContain("<script>MARKER</script>");
	expect(result).toContain("<h1>Test</h1>");
	expect(result).toEndWith("<script>MARKER</script>");
});

test("does not inject script into non-HTML responses", async () => {
	const middleware = new DevModeAutoRefreshMiddleware({});
	const json = JSON.stringify({ test: "data" });
	const next = mock(
		() =>
			new Response(json, {
				headers: { "Content-Type": "application/json" },
			}),
	);

	const generateScriptSpy = spyOn(middleware as any, "generateScript");
	generateScriptSpy.mockReturnValue("<script>MARKER</script>");

	const response = await middleware.handle(controllerContext(), next);

	const result = await response.text();

	expect(result).not.toContain("<script>MARKER</script>");
	expect(result).toBe(json);
	expect(generateScriptSpy).not.toHaveBeenCalled();
});
