import { wrapRouteHandler } from "aku/integrations/next";

export const GET = wrapRouteHandler(() => {
	return new Response("Hello!");
});
