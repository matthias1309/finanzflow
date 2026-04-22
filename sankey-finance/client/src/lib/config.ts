/**
 * Zentrale Konfiguration für API-Zugriff.
 *
 * Im Perplexity-Sandbox-Modus wird __PORT_5000__ zur Laufzeit ersetzt.
 * Im Uberspace-Deployment wird VITE_API_BASE=/finanzflow beim Build gesetzt.
 * In der lokalen Entwicklung bleibt API_BASE leer (relativer Pfad).
 */
export const API_BASE: string =
  ("__PORT_5000__" as string).startsWith("__")
    ? (import.meta.env.VITE_API_BASE ?? "")
    : "__PORT_5000__";

/**
 * Sanitiert einen Farbwert aus der Datenbank bevor er in ein style-Attribut einfließt.
 * Erlaubt ausschließlich #rrggbb und #rgb — alle anderen Werte fallen auf ein sicheres
 * Grau zurück, um CSS-Injection zu verhindern.
 */
export function safeCssColor(color: string | null | undefined): string {
  if (!color) return "#7a7974";
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : "#7a7974";
}
