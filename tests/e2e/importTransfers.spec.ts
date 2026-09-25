import { test } from "@playwright/test";

// TC-017-11
// Given a preview row marked as a transfer to "DKB Giro"
// When the user selects "Keine Umbuchung" as the target account and clicks "Importieren"
// Then the transaction is stored with type "expense"
// And transferToAccountId is null
test("should store an expense without transfer target after the user selects \"Keine Umbuchung\"", async () => {
  // Arrange

  // Act

  // Assert
  throw new Error("not implemented");
});

// TC-017-12
// Given a preview row marked as a counter-booking and excluded by default
// When the user re-includes the row and clicks "Importieren"
// Then the transaction is stored as an income on the selected account
test("should store a counter-booking as income after the user re-includes it", async () => {
  // Arrange

  // Act

  // Assert
  throw new Error("not implemented");
});

// TC-017-14
// Given a stored income transaction of 300,00 € on "DKB Giro" dated 2026-09-10
// And a preview row for a debit of 300,00 € on "N26" shows "Umbuchung" to "DKB Giro" and "Ersetzt Einnahme vom 10.09.2026"
// When the user clicks "Importieren"
// Then a transaction of type "transfer" from "N26" to "DKB Giro" of 300,00 € is stored
// And the stored income transaction on "DKB Giro" no longer exists
// And GET /api/summary/2026-09 counts the 300,00 € as a transfer only, not as income of "DKB Giro"
test("should delete the replaced stored income after importing the transfer", async () => {
  // Arrange

  // Act

  // Assert
  throw new Error("not implemented");
});

// TC-017-15
// Given a preview row that shows "Umbuchung" to "DKB Giro" and "Ersetzt Einnahme vom 10.09.2026"
// When the user selects "Keine Umbuchung" as the target account and clicks "Importieren"
// Then the row is stored as an expense on "N26"
// And the stored income transaction on "DKB Giro" still exists
test("should keep the stored income when the user overrides the replacing transfer", async () => {
  // Arrange

  // Act

  // Assert
  throw new Error("not implemented");
});

// TC-017-17
// Given a preview row that shows "Ersetzt Einnahme vom 10.09.2026"
// And the server rejects the request that deletes the replaced income transaction
// When the user clicks "Importieren"
// Then the transfer is stored
// And the user sees "Einnahme vom 10.09.2026 konnte nicht entfernt werden"
test("should warn when the replaced income cannot be deleted", async () => {
  // Arrange

  // Act

  // Assert
  throw new Error("not implemented");
});
