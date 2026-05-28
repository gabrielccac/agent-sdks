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

const jobs: Promise<void>[] = [];

if (runSdk) {
  jobs.push((async () => {
    console.log('[sdk ] running...');
    const result = await extractFromDocuments(documents);
    const file   = await saveResult('sdk', codigoCompra, result);
    console.log(`[sdk ] done — tokens: ${result.usage?.inputTokens ?? '?'} in / ${result.usage?.outputTokens ?? '?'} out`);
    console.log(`[sdk ] saved → ${file}`);
  })());
}

if (runApi) {
  jobs.push((async () => {
    console.log('[api ] running...');
    const result = await extractFromDocumentsApi(documents);
    const file   = await saveResult('api', codigoCompra, result);
    console.log(`[api ] done — tokens: ${result.usage?.inputTokens ?? '?'} in / ${result.usage?.outputTokens ?? '?'} out`);
    console.log(`[api ] saved → ${file}`);
  })());
}

await Promise.all(jobs);
console.log('\nDone. Compare saved files to review differences.');
