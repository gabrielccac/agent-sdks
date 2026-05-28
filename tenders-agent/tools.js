import { tool } from '@openai/agents';
import { z } from 'zod';
import { generateFormula } from './formula-generator.js';

const BASE   = 'app3ZwUila8cvLYLu';
const TABLE  = 'tbldNqB7CyC0bii06';
const FIELDS = [
  'CodigoCompra', 'Modalidade', 'Descricao', 'Status',
  'Preco', 'DataLeilao', 'Orgao', 'UF', 'URL', 'PrazoEntrega',
];

async function fetchRecords(formula, limit = 50) {
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
  const data = await res.json();

  if (!data.records.length) return 'Nenhuma disputa encontrada com esses critérios.';
  return data.records.map(r => ({
    CodigoCompra: r.fields.CodigoCompra,
    Modalidade:   r.fields.Modalidade?.name ?? r.fields.Modalidade,
    Descricao:    r.fields.Descricao,
    Status:       r.fields.Status?.name    ?? r.fields.Status,
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
    description: 'Fetch tenders from the Disputas table. Describe what you want in plain language — status, date range, state, price, keyword, or any combination.',
    parameters: z.object({
      request: z.string().describe(
        'Natural language description of the filter, e.g. "active tenders this week in SP" or "tenders we won" or "all tenders".'
      ),
    }),
    execute: async ({ request }) => {
      const { formula, limit } = await generateFormula(request);
      console.log(`[formula] ${formula || '(none — fetch all)'}`);
      return fetchRecords(formula, limit);
    },
  }),
];
