import { delete as delete_, get, group, post } from "@akujs/aku/http";
import {
	DeleteCookieController,
	EchoParamController,
	GetCookiesController,
	SetCookieController,
} from "../controllers/CookieApiController";

export default group({}, [
	get("/aku/hello", () => new Response("Hello from Aku on Nitro!")),

	// API routes for cookie testing
	get("/aku/api/cookies", GetCookiesController),
	post("/aku/api/cookies", SetCookieController),
	delete_("/aku/api/cookies/{name}", DeleteCookieController),

	// API routes for param testing
	get("/aku/api/param/{param}/test", EchoParamController),
]);
