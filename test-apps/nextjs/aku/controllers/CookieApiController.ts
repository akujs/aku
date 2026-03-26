import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export function GetCookiesController(c: Context): Response {
	const cookies = getCookie(c);
	return c.json({ cookies });
}

export async function SetCookieController(c: Context): Promise<Response> {
	const body = (await c.req.json()) as Record<string, unknown>;

	if (!body.name) {
		return c.json({ error: "Cookie name is required" }, 400);
	}

	const options = (body.options ?? {}) as Record<string, unknown>;
	setCookie(c, body.name as string, (body.value as string) || "", {
		path: options.path as string | undefined,
		domain: options.domain as string | undefined,
		secure: options.secure as boolean | undefined,
		httpOnly: options.httpOnly as boolean | undefined,
		maxAge: options.maxAge as number | undefined,
		expires: options.expires ? new Date(options.expires as string) : undefined,
		sameSite: options.sameSite as "Strict" | "Lax" | "None" | undefined,
		partitioned: options.partitioned as boolean | undefined,
	});

	return c.json({
		success: true,
		cookie: { name: body.name, value: body.value, options: body.options },
	});
}

export function DeleteCookieController(c: Context): Response {
	const name = c.req.param("name");

	if (!name) {
		return c.json({ error: "Cookie name is required" }, 400);
	}

	deleteCookie(c, name);

	return c.json({ success: true, deleted: name });
}

export function EchoParamController(c: Context): Response {
	return c.json({ param: c.req.param("param") });
}
