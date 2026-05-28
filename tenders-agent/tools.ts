import { tool } from '@openai/agents';
import { z } from 'zod';

const BASE   = 'app3ZwUila8cvLYLu';
const TABLE  = 'tbldNqB7CyC0bii06';
const FIELDS = [
  'CodigoCompra', 'Modalidade', 'Descricao', 'Status',
  'Preco', 'DataLeilao', 'Orgao', 'UF', 'URL', 'PrazoEntrega',
] as const;

interface AirtableFields {
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
}

interface AirtableResponse {
  records: Array<{ id: string; fields: AirtableFields }>;
}

export interface TenderRecord {
  CodigoCompra: string | undefined;
  Modalidade:   string | undefined;
  Descricao:    string | undefined;
  Status:       string | undefined;
  Preco:        number | undefined;
  DataLeilao:   string | undefined;
  Orgao:        string | undefined;
  UF:           string | undefined;
  URL:          string | undefined;
  PrazoEntrega: string | undefined;
}

function selectName(v: { name: string } | string | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === 'object' ? v.name : v;
}

async function fetchRecords(formula: string, limit = 50): Promise<TenderRecord[] | string> {
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  if (formula) url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('sort[0][field]', 'DataLeilao');
  url.searchParams.set('sort[0][direction]', 'asc');
  FIELDS.forEach(f => url.searchParams.append('fields[]', f));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as AirtableResponse;
  if (!data.records.length) return 'Nenhuma disputa encontrada com esses critérios.';

  return data.records.map(r => ({
    CodigoCompra: r.fields.CodigoCompra,
    Modalidade:   selectName(r.fields.Modalidade),
    Descricao:    r.fields.Descricao,
    Status:       selectName(r.fields.Status),
    Preco:        r.fields.Preco,
    DataLeilao:   r.fields.DataLeilao,
    Orgao:        r.fields.Orgao,
    UF:           r.fields.UF,
    URL:          r.fields.URL,
    PrazoEntrega: r.fields.PrazoEntrega,
  }));
}

export const tools = [
  tool({
    name: 'query_tenders',
    description: 'Query the Disputas table with an Airtable filterByFormula string. Pass empty string to fetch all records.',
    parameters: z.object({
      formula: z.string().describe('Airtable filterByFormula expression. See instructions for syntax reference.'),
      limit:   z.number().int().positive().optional().describe('Max records to return. Defaults to 50.'),
    }),
    execute: ({ formula, limit }) => fetchRecords(formula, limit),
  }),
];
