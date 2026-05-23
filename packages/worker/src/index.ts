import { Hono } from "hono";
import { accessAuth } from "./middleware/access-auth.js";
import { liveRoute } from "./routes/live.js";
import type { AppEnv } from "./types.js";

const app = new Hono<AppEnv>();

app.use("/api/*", accessAuth);

app.get("/api/live", liveRoute);

export default app;
