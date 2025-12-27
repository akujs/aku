import { apiResource, delete as delete_, get, group, post, redirect } from "beynac/http";
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
	get("/beynac", redirect("/beynac/cookies")),
	get("/beynac/cookies", CookiePageController),
	get("/beynac/storage", StoragePageController),
	post("/beynac/storage/upload", StorageUploadController),
	post("/beynac/storage/delete/{filename}", StorageDeleteController),

	// API routes for cookie testing
	get("/beynac/api/cookies", GetCookiesController),
	post("/beynac/api/cookies", SetCookieController),
	delete_("/beynac/api/cookies/{name}", DeleteCookieController),

	// API routes for param testing
	get("/beynac/api/param/{param}/test", EchoParamController),

	// API routes for storage testing
	apiResource("/beynac/api/storage", StorageController),

	get("/people/{personId}", CookiePageController, { name: "people" }),
]);
