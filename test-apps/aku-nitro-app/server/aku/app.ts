import { createApplication } from "@akujs/aku";
import { Hono } from "hono";
import {
	DeleteCookieController,
	EchoParamController,
	GetCookiesController,
	SetCookieController,
} from "./controllers/CookieApiController";

const hono = new Hono();

hono.get("/aku/hello", () => new Response("Hello from Aku on Nitro!"));

// API routes for cookie testing
hono.get("/aku/api/cookies", GetCookiesController);
hono.post("/aku/api/cookies", SetCookieController);
hono.delete("/aku/api/cookies/:name", DeleteCookieController);

// API routes for param testing
hono.get("/aku/api/param/:param/test", EchoParamController);

export const app = createApplication({
	handler: hono.fetch,
	development: true,
	appUrl: {},
});
