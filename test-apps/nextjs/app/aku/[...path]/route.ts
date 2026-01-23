import { makeRouteHandlers } from "@akujs/aku/integrations/next";
import { app } from "@/aku/app";

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = makeRouteHandlers(app);
