import type { Express } from "express";
import type { Server } from "http";
import { accountsRouter }      from "./routes/accounts";
import { categoriesRouter }    from "./routes/categories";
import { transactionsRouter }  from "./routes/transactions";
import { pdfRouter }           from "./routes/pdf";
import { categoryRulesRouter } from "./routes/categoryRules";
import { summaryRouter }       from "./routes/summary";
import { storage }             from "./storage";

export function registerRoutes(_httpServer: Server, app: Express): void {
  app.use("/api/accounts",        accountsRouter);
  app.use("/api/categories",      categoriesRouter);
  app.use("/api/transactions",    transactionsRouter);
  app.use("/api/import/pdf",      pdfRouter);
  app.use("/api/category-rules",  categoryRulesRouter);
  app.use("/api/summary",         summaryRouter);

  app.get("/api/months", (_req, res) => {
    res.json(storage.getAvailableMonths());
  });
}
