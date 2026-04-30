/**
 * Notfall-Reset für 2FA.
 *
 * Verwendung (auf dem Server):
 *   npm run 2fa:reset
 *
 * Löscht TOTP-Secret, Pending-Secret, Last-Used-Token und alle Recovery-Codes.
 * Nach dem Reset reicht beim nächsten Login das Passwort allein.
 */

import { inArray } from "drizzle-orm";
import { db } from "../server/db";
import { appSettings, recoveryCodes } from "../shared/schema";

async function reset2fa() {
  console.log("2FA-Reset wird durchgeführt…");

  db.delete(recoveryCodes).run();
  console.log("  ✓ Recovery-Codes gelöscht");

  db.delete(appSettings)
    .where(inArray(appSettings.key, ["totp_secret", "totp_pending_secret", "totp_last_used_token"]))
    .run();
  console.log("  ✓ TOTP-Secret und Sitzungsdaten entfernt");

  console.log("\n2FA wurde zurückgesetzt. Beim nächsten Login reicht das Passwort allein.");
  console.log("Das Dashboard zeigt anschließend den Setup-Prompt erneut an.");
}

reset2fa().catch(e => {
  console.error("Fehler beim Reset:", e);
  process.exit(1);
});
