import { unlink } from "fs/promises";

// Delete the E2E test database before each Playwright run so every run starts clean.
export default async function globalSetup() {
  try {
    await unlink("/tmp/finanzflow_e2e.db");
  } catch {
    // File doesn't exist on first run — ignore.
  }
}
