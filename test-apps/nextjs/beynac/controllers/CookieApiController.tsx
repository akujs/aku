import { Cookies } from "beynac/facades";
import type { Controller } from "beynac/http";

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export const GetCookiesController: Controller = () => {
	const cookies = Object.fromEntries(Cookies.entries());
	return jsonResponse({ cookies });
};

export const SetCookieController: Controller = async ({ request }) => {
	const body = (await request.json()) as any;

	if (!body.name) {
		return jsonResponse({ error: "Cookie name is required" }, 400);
	}

	Cookies.set(body.name, body.value || "", body.options);

	return jsonResponse({
		success: true,
		cookie: { name: body.name, value: body.value, options: body.options },
	});
};

export const DeleteCookieController: Controller = ({ params }) => {
	const { name } = params;

	if (!name) {
		return jsonResponse({ error: "Cookie name is required" }, 400);
	}

	Cookies.delete(name);

	return jsonResponse({ success: true, deleted: name });
};

export const EchoParamController: Controller = async ({ params }) => {
	return jsonResponse({ param: params.param });
};
