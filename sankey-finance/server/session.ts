import session from "express-session";
import MemoryStore from "memorystore";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    pendingTotp?:   boolean;
    stepUpAt?:      number;
  }
}

const Store    = MemoryStore(session);
const maxAgeMs = (parseInt(process.env.SESSION_MAX_AGE_HOURS ?? "8", 10)) * 60 * 60 * 1000;

export const sessionMiddleware = session({
  secret:            process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
  resave:            false,
  saveUninitialized: false,
  store:             new Store({ checkPeriod: 86_400_000 }),
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   maxAgeMs,
  },
});
