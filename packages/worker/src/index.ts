import { Hono } from "hono";
import { accessAuth } from "./middleware/access-auth.js";
import { authRoutes } from "./routes/auth.js";
import { docTypeRoutes } from "./routes/doc-types.js";
import { documentRoutes } from "./routes/documents.js";
import { fieldRoutes } from "./routes/fields.js";
import { liveRoute } from "./routes/live.js";
import { meRoute } from "./routes/me.js";
import { personRoutes } from "./routes/persons.js";
import { tagRoutes } from "./routes/tags.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use("/api/*", accessAuth);

app.get("/api/live", liveRoute);
app.get("/api/me", meRoute);
app.route("/api/auth", authRoutes);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/w/:wid/persons", personRoutes);
app.route("/api/w/:wid/fields", fieldRoutes);
app.route("/api/w/:wid/doc-types", docTypeRoutes);
app.route("/api/w/:wid/documents", documentRoutes);
app.route("/api/w/:wid/tags", tagRoutes);

export default app;
