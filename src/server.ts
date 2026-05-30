import index from "../web/index.html";
import { runCcusage } from "./ccusage";
import { handleUsage } from "./usage-handler";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/api/usage": {
      GET: (req) => handleUsage(req, { run: runCcusage, now: () => new Date() }),
    },
  },
});

console.log(`ccusage-dash running at http://localhost:${server.port}`);
