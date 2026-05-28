import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { airtableFetch } from '../tools/airtable.js';
import { extractFromDocumentsApi } from './extractor-api.js';
import type { DocumentInput } from './prompt.js';

const codigoCompra = process.argv[2];
if (!codigoCompra) {
  console.error('Usage: tsx analysis/run.ts <CodigoCompra>');
  process.exit(1);
}

if (!process.env.AIRTABLE_TOKEN)               { console.error('Missing AIRTABLE_TOKEN');                process.exit(1); }
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) { console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY'); process.exit(1); }

const RESULTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');

async function saveResult(label: string, codigo: string, data: unknown): Promise<string> {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(RESULTS_DIR, `${codigo}__${label}__${ts}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  return file;
}

console.log(`Fetching documents for: ${codigoCompra}\n`);

const data = await airtableFetch({
  filterByFormula: `{CodigoCompra}="${codigoCompra}"`,
  fields:          ['CodigoCompra', 'Anexos'],
  pageSize:        '1',
});

if (!data.records.length) { console.error(`No tender found: "${codigoCompra}"`); process.exit(1); }

const anexos = data.records[0].fields.Anexos;
if (!anexos?.length)      { console.error(`No attachments for "${codigoCompra}"`); process.exit(1); }

const documents: DocumentInput[] = anexos.map(a => ({ filename: a.filename, url: a.url }));
console.log(`Documents: ${documents.map(d => d.filename).join(', ')}\n`);

try {
  const result = await extractFromDocumentsApi(documents);
  const file   = await saveResult('extraction', codigoCompra, result);
  console.log(`Done — tokens: ${result.usage?.inputTokens ?? '?'} in / ${result.usage?.outputTokens ?? '?'} out`);
  console.log(`Saved → ${file}`);
} catch (err) {
  const error  = err as Error & { value?: unknown };
  const file   = await saveResult('error', codigoCompra, { error: error.message, value: error.value ?? null });
  console.error(`Failed: ${error.message}`);
  console.error(`Saved error → ${file}`);
}
