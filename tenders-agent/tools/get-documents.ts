import { tool } from '@openai/agents';
import { z } from 'zod';
import { airtableFetch, AirtableAttachment } from './airtable.js';

export interface TenderDocument {
  id:       string;
  filename: string;
  url:      string;
  size:     number;
  type:     string;
}

async function fetchDocuments(codigoCompra: string): Promise<TenderDocument[] | string> {
  const data = await airtableFetch({
    filterByFormula: `{CodigoCompra}="${codigoCompra}"`,
    fields:          ['CodigoCompra', 'Anexos'],
    pageSize:        '1',
  });

  if (!data.records.length) {
    return `Nenhuma disputa encontrada com CodigoCompra "${codigoCompra}".`;
  }

  const anexos = data.records[0].fields.Anexos as AirtableAttachment[] | undefined;
  if (!anexos?.length) {
    return `Nenhum documento encontrado para a disputa "${codigoCompra}".`;
  }

  return anexos.map(a => ({
    id:       a.id,
    filename: a.filename,
    url:      a.url,
    size:     a.size,
    type:     a.type,
  }));
}

export const getDocumentsTool = tool({
  name: 'get_documents',
  description: 'Fetch the attached documents (Anexos) for a tender by its CodigoCompra. Returns file names and download URLs.',
  parameters: z.object({
    codigoCompra: z.string().describe('The CodigoCompra of the tender to fetch documents for.'),
  }),
  execute: ({ codigoCompra }) => fetchDocuments(codigoCompra),
});
