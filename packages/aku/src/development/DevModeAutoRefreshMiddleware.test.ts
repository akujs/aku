import { describe, expect, test } from "bun:test";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware.ts";

describe(DevModeAutoRefreshMiddleware, () => {
	test("handleSseRequest returns null for non-SSE requests", () => {
		const middleware = new DevModeAutoRefreshMiddleware({});

		const result = middleware.handleSseRequest(new Request("http://example.com/page"));

		expect(result).toBeNull();
	});

	test("handleSseRequest returns event stream for SSE requests", () => {
		const middleware = new DevModeAutoRefreshMiddleware({});

		const response = middleware.handleSseRequest(
			new Request("http://example.com?__aku_dev_mode_refresh"),
		);

		expect(response).toBeInstanceOf(Response);
		expect(response!.headers.get("Content-Type")).toBe("text/event-stream");
		expect(response!.headers.get("Cache-Control")).toBe("no-cache");
		expect(response!.headers.get("Connection")).toBe("keep-alive");
	});

	test("injectScriptIfHtml injects script into HTML response before </body>", async () => {
		const middleware = new DevModeAutoRefreshMiddleware({});
		const html = "<html><body><h1>Test</h1></body></html>";
		const response = new Response(html, {
			headers: { "Content-Type": "text/html" },
		});

		const result = middleware.injectScriptIfHtml(response);
		const text = await result.text();

		expect(text).toContain("<script>");
		expect(text).toContain("<h1>Test</h1>");
		expect(text.indexOf("<script>")).toBeLessThan(text.indexOf("</body>"));
	});

	test("injectScriptIfHtml injects script before </html> if no </body>", async () => {
		const middleware = new DevModeAutoRefreshMiddleware({});
		const html = "<html><h1>Test</h1></html>";
		const response = new Response(html, {
			headers: { "Content-Type": "text/html" },
		});

		const result = middleware.injectScriptIfHtml(response);
		const text = await result.text();

		expect(text).toContain("<script>");
		expect(text).toContain("<h1>Test</h1>");
		expect(text.indexOf("<script>")).toBeLessThan(text.indexOf("</html>"));
	});

	test("injectScriptIfHtml appends script at end if no closing tags", async () => {
		const middleware = new DevModeAutoRefreshMiddleware({});
		const html = "<h1>Test</h1>";
		const response = new Response(html, {
			headers: { "Content-Type": "text/html" },
		});

		const result = middleware.injectScriptIfHtml(response);
		const text = await result.text();

		expect(text).toContain("<script>");
		expect(text).toContain("<h1>Test</h1>");
		expect(text).toEndWith("</script>");
	});

	test("injectScriptIfHtml does not modify non-HTML responses", async () => {
		const middleware = new DevModeAutoRefreshMiddleware({});
		const json = JSON.stringify({ test: "data" });
		const response = new Response(json, {
			headers: { "Content-Type": "application/json" },
		});

		const result = middleware.injectScriptIfHtml(response);
		const text = await result.text();

		expect(text).not.toContain("<script>");
		expect(text).toBe(json);
	});
});
