import { once } from "events";
import type { Server } from "http";

import type { Express } from "express";

// Passing the Express app to supertest (`request(app)`) starts a fresh server per request on an
// ephemeral port bound to `::`, then connects to 127.0.0.1. On macOS another test process can
// bind the same port on 127.0.0.1 at the same time, so the request reaches that process's app
// (random 401/404 when Vitest runs test files in parallel). One server per test file, bound to
// 127.0.0.1 itself, lets the kernel rule out that collision.
export async function listenOnLoopback(app: Express): Promise<Server> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}
