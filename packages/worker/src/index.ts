import { Hono } from "hono";
import { accessAuth } from "./middleware/access-auth.js";
import { liveRoute } from "./routes/live.js";
import { personRoutes } from "./routes/persons.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use("/api/*", accessAuth);

app.get("/api/live", liveRoute);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/w/:wid/persons", personRoutes);

export default app;
