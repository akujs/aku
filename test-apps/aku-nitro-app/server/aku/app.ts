import { createApplication } from "@akujs/aku";
import routes from "./routes/web";

export const app = createApplication({
	routes,
	development: true,
	appUrl: {},
});
