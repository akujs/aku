import { ApplicationImpl } from "./ApplicationImpl.ts";
import type { Application } from "./contracts/Application.ts";
import type { Configuration } from "./contracts/Configuration.ts";
import { setFacadeApplication } from "./facade.ts";

/***/
export const createApplication = <RouteParams extends Record<string, string> = {}>(
	config: Configuration<RouteParams> = {},
): Application<RouteParams> => {
	const app = new ApplicationImpl<RouteParams>(config);
	setFacadeApplication(app);
	app.bootstrap();
	return app;
};
