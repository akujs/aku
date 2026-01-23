import { wrapRouteHandler } from "@akujs/aku/integrations/next";

export const GET = wrapRouteHandler(() => {
	return new Response("Hello!");
});
