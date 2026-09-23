// Client für die Paperless-ngx REST-API — liefert Kontoauszug-Dokumente
// samt ihren Tag-Namen und lädt einzelne Dokumente als PDF-Buffer.

export const KONTOAUSZUG_TAG = "Kontoauszug";
const PAGE_SIZE = 200;

export class PaperlessConfigError extends Error {
  constructor() {
    super("Paperless ist nicht konfiguriert (PAPERLESS_BASE_URL/PAPERLESS_API_TOKEN fehlen)");
    this.name = "PaperlessConfigError";
  }
}

export class PaperlessUnreachableError extends Error {
  constructor() {
    super("Paperless ist nicht erreichbar");
    this.name = "PaperlessUnreachableError";
  }
}

export class PaperlessAuthError extends Error {
  constructor() {
    super("Paperless-Zugriff nicht autorisiert");
    this.name = "PaperlessAuthError";
  }
}

export class PaperlessApiError extends Error {
  constructor(status: number) {
    super(`Paperless-Anfrage fehlgeschlagen (${status})`);
    this.name = "PaperlessApiError";
  }
}

export interface PaperlessDocumentWithTags {
  readonly id: number;
  readonly title: string;
  readonly created: string;
  readonly tags: readonly string[];
}

interface PaperlessTagsResponse {
  results: { id: number; name: string }[];
}

interface PaperlessDocumentsResponse {
  results: { id: number; title: string; created: string; tags: number[] }[];
}

function getConfig(): { baseUrl: string; apiToken: string } {
  const baseUrl = process.env.PAPERLESS_BASE_URL;
  const apiToken = process.env.PAPERLESS_API_TOKEN;
  if (!baseUrl || !apiToken) throw new PaperlessConfigError();
  return { baseUrl, apiToken };
}

async function paperlessFetch(path: string): Promise<Response> {
  const { baseUrl, apiToken } = getConfig();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Token ${apiToken}` } });
  } catch {
    throw new PaperlessUnreachableError();
  }

  if (res.status === 401 || res.status === 403) throw new PaperlessAuthError();
  if (!res.ok) throw new PaperlessApiError(res.status);
  return res;
}

async function fetchTagNamesById(): Promise<Map<number, string>> {
  const res = await paperlessFetch(`/api/tags/?page_size=${PAGE_SIZE}`);
  const json = (await res.json()) as PaperlessTagsResponse;
  return new Map(json.results.map(t => [t.id, t.name]));
}

/** Alle offenen (nicht importierten) Filter übernimmt der Aufrufer — hier: alle mit Tag "Kontoauszug". */
export async function fetchKontoauszugDocuments(): Promise<PaperlessDocumentWithTags[]> {
  const tagNamesById = await fetchTagNamesById();
  const res = await paperlessFetch(
    `/api/documents/?tags__name__iexact=${encodeURIComponent(KONTOAUSZUG_TAG)}&page_size=${PAGE_SIZE}`
  );
  const json = (await res.json()) as PaperlessDocumentsResponse;

  return json.results.map(d => ({
    id: d.id,
    title: d.title,
    created: d.created,
    tags: d.tags.map(id => tagNamesById.get(id)).filter((name): name is string => name != null),
  }));
}

export async function downloadDocument(documentId: number): Promise<Buffer> {
  const res = await paperlessFetch(`/api/documents/${documentId}/download/`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
