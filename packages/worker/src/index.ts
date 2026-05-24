import { Hono } from "hono";
import { accessAuth } from "./middleware/access-auth.js";
import { docTypeRoutes } from "./routes/doc-types.js";
import { documentRoutes } from "./routes/documents.js";
import { fieldRoutes } from "./routes/fields.js";
import { liveRoute } from "./routes/live.js";
import { personRoutes } from "./routes/persons.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use("/api/*", accessAuth);

app.get("/api/live", liveRoute);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/w/:wid/persons", personRoutes);
app.route("/api/w/:wid/fields", fieldRoutes);
app.route("/api/w/:wid/doc-types", docTypeRoutes);
app.route("/api/w/:wid/documents", documentRoutes);

export default app;
