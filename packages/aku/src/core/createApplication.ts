import { ApplicationImpl } from "./ApplicationImpl.ts";
import type { Application } from "./contracts/Application.ts";
import type { Configuration } from "./contracts/Configuration.ts";
import { setFacadeApplication } from "./facade.ts";

/***/
export const createApplication = (config: Configuration = {}): Application => {
	const app = new ApplicationImpl(config);
	setFacadeApplication(app);
	app.bootstrap();
	return app;
};
