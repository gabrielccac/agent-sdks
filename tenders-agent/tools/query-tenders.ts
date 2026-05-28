import { tool } from '@openai/agents';
import { z } from 'zod';
import { airtableFetch, selectName } from './airtable.js';

const FIELDS = [
  'CodigoCompra', 'Modalidade', 'Descricao', 'Status',
  'Preco', 'DataLeilao', 'Orgao', 'UF', 'URL', 'PrazoEntrega',
];

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

async function fetchRecords(formula: string, limit = 50): Promise<TenderRecord[] | string> {
  const params: Record<string, string | string[]> = {
    fields:               FIELDS,
    pageSize:             String(limit),
    'sort[0][field]':     'DataLeilao',
    'sort[0][direction]': 'asc',
  };
  if (formula) params.filterByFormula = formula;

  const data = await airtableFetch(params);
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

export const queryTendersTool = tool({
  name: 'query_tenders',
  description: 'Query the Disputas table with an Airtable filterByFormula string. Pass empty string to fetch all records.',
  parameters: z.object({
    formula: z.string().describe('Airtable filterByFormula expression. See instructions for syntax reference.'),
    limit:   z.number().int().positive().optional().describe('Max records to return. Defaults to 50.'),
  }),
  execute: ({ formula, limit }) => fetchRecords(formula, limit),
});
