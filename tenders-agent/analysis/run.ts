import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { airtableFetch } from '../tools/airtable.js';
import { extractFromDocuments } from './extractor.js';
import { extractFromDocumentsApi } from './extractor-api.js';
import type { DocumentInput } from './prompt.js';

const args         = process.argv.slice(2);
const codigoCompra = args.find(a => !a.startsWith('--'));
const runSdk       = !args.includes('--api-only');
const runApi       = !args.includes('--sdk-only');

if (!codigoCompra) {
  console.error('Usage: tsx analysis/run.ts <CodigoCompra> [--sdk-only] [--api-only]');
  process.exit(1);
}

if (!process.env.AIRTABLE_TOKEN)               { console.error('Missing AIRTABLE_TOKEN');                process.exit(1); }
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) { console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY'); process.exit(1); }

const RESULTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');

async function saveResult(label: string, codigoCo: string, data: unknown): Promise<string> {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(RESULTS_DIR, `${codigoCo}__${label}__${ts}.json`);
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

async function runExtractor(label: string, fn: () => Promise<unknown>): Promise<void> {
  console.log(`[${label}] running...`);
  try {
    const result = await fn();
    const file   = await saveResult(label, codigoCompra!, result);
    const r = result as { usage?: { inputTokens?: number; outputTokens?: number } };
    console.log(`[${label}] done — tokens: ${r.usage?.inputTokens ?? '?'} in / ${r.usage?.outputTokens ?? '?'} out`);
    console.log(`[${label}] saved → ${file}`);
  } catch (err) {
    const error  = err as Error & { value?: unknown };
    const detail = { error: error.message, value: error.value ?? null };
    const file   = await saveResult(`${label}-error`, codigoCompra!, detail).catch(() => '(could not save)');
    console.error(`[${label}] failed: ${error.message}`);
    console.error(`[${label}] saved error → ${file}`);
  }
}

await Promise.all([
  runSdk ? runExtractor('sdk', () => extractFromDocuments(documents))    : Promise.resolve(),
  runApi ? runExtractor('api', () => extractFromDocumentsApi(documents)) : Promise.resolve(),
]);

console.log('\nDone.');
