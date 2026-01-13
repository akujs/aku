import { apiResource, delete as delete_, get, group, post, redirect } from "aku/http";
import {
	DeleteCookieController,
	EchoParamController,
	GetCookiesController,
	SetCookieController,
} from "../controllers/CookieApiController";
import { CookiePageController } from "../controllers/CookiePageController";
import { StorageController } from "../controllers/StorageController";
import {
	StorageDeleteController,
	StoragePageController,
	StorageUploadController,
} from "../controllers/StoragePageController";

export default group({}, [
	// Page routes
	get("/aku", redirect("/aku/cookies")),
	get("/aku/cookies", CookiePageController),
	get("/aku/storage", StoragePageController),
	post("/aku/storage/upload", StorageUploadController),
	post("/aku/storage/delete/{filename}", StorageDeleteController),

	// API routes for cookie testing
	get("/aku/api/cookies", GetCookiesController),
	post("/aku/api/cookies", SetCookieController),
	delete_("/aku/api/cookies/{name}", DeleteCookieController),

	// API routes for param testing
	get("/aku/api/param/{param}/test", EchoParamController),

	// API routes for storage testing
	apiResource("/aku/api/storage", StorageController),

	get("/people/{personId}", CookiePageController, { name: "people" }),
]);
