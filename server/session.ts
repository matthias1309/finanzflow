import session from "express-session";
import MemoryStore from "memorystore";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    pendingTotp?:   boolean;
    stepUpAt?:      number;
    userId?:        number;
  }
}

const Store    = MemoryStore(session);
const maxAgeMs = (parseInt(process.env.SESSION_MAX_AGE_HOURS ?? "8", 10)) * 60 * 60 * 1000;

// In Docker, never use secure flag (HTTP connections over local network)
// Only use secure flag in actual production HTTPS deployments
const isDockerDeploy = process.env.DOCKER_DEPLOY === "true";
const shouldUseSecure = process.env.NODE_ENV === "production" && !isDockerDeploy;

export const sessionMiddleware = session({
  secret:            process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
  resave:            false,
  saveUninitialized: true,
  store:             new Store({ checkPeriod: 86_400_000 }),
  cookie: {
    httpOnly: true,
    secure:   shouldUseSecure,
    sameSite: "lax",
    maxAge:   maxAgeMs,
    path:     "/",
  },
});
