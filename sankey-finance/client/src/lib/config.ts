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
