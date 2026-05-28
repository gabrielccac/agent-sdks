const BASE  = 'app3ZwUila8cvLYLu';
const TABLE = 'tbldNqB7CyC0bii06';

export const BASE_URL = `https://api.airtable.com/v0/${BASE}/${TABLE}`;

export interface AirtableAttachment {
  id:       string;
  url:      string;
  filename: string;
  size:     number;
  type:     string;
}

export interface AirtableFields {
  CodigoCompra?: string;
  Modalidade?:   { name: string } | string;
  Descricao?:    string;
  Status?:       { name: string } | string;
  Preco?:        number;
  DataLeilao?:   string;
  Orgao?:        string;
  UF?:           string;
  URL?:          string;
  PrazoEntrega?: string;
  Anexos?:       AirtableAttachment[];
}

export interface AirtableRecord {
  id:     string;
  fields: AirtableFields;
}

export interface AirtableResponse {
  records: AirtableRecord[];
}

export function selectName(v: { name: string } | string | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === 'object' ? v.name : v;
}

export async function airtableFetch(params: Record<string, string | string[]>): Promise<AirtableResponse> {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v.forEach(item => url.searchParams.append(`${k}[]`, item));
    } else {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json() as Promise<AirtableResponse>;
}
