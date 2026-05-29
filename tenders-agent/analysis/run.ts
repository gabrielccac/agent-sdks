import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { airtableFetch } from '../tools/airtable.js';
import { extractFromDocumentsApi } from './extractor-api.js';
import { runAnalysisWorkflow } from './workflow.js';
import { fetchComprasNetData } from '../api/comprasnet.js';
import type { DocumentInput } from './prompt.js';

const args        = process.argv.slice(2);
const fullMode    = args.includes('--full');
const codigoCompra = args.find(a => !a.startsWith('--'));

if (!codigoCompra) {
  console.error('Usage: tsx analysis/run.ts <CodigoCompra> [--full]');
  console.error('  --full  fetch API data + run reviewer after extraction');
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

const airtableData = await airtableFetch({
  filterByFormula: `{CodigoCompra}="${codigoCompra}"`,
  fields:          ['CodigoCompra', 'Anexos'],
  pageSize:        '1',
});

if (!airtableData.records.length) { console.error(`No tender found: "${codigoCompra}"`); process.exit(1); }

const record = airtableData.records[0].fields;
const anexos = record.Anexos;
if (!anexos?.length) { console.error(`No attachments for "${codigoCompra}"`); process.exit(1); }

const documents: DocumentInput[] = anexos.map(a => ({ filename: a.filename, url: a.url }));
console.log(`Documents: ${documents.map(d => d.filename).join(', ')}\n`);

try {
  if (fullMode) {
    console.log('Mode: full (extraction + review)\n');

    console.log('Fetching tender API data...');
    const apiData = await fetchComprasNetData(codigoCompra);

    const result = await runAnalysisWorkflow({ codigoCompra, documents, apiData });
    const file   = await saveResult('workflow', codigoCompra, result);

    const { review, status, extraction } = result;
    const errors   = review.flags.filter(f => f.severity === 'error');
    const warnings = review.flags.filter(f => f.severity === 'warning');

    console.log(`Status: ${status}`);
    console.log(`Tokens: ${extraction.usage?.inputTokens ?? '?'} in / ${extraction.usage?.outputTokens ?? '?'} out`);
    console.log(`Re-extracted: ${review.reExtracted}`);
    if (errors.length)   console.log(`Errors (${errors.length}):\n${errors.map(f => `  [${f.field}] ${f.message}`).join('\n')}`);
    if (warnings.length) console.log(`Warnings (${warnings.length}):\n${warnings.map(f => `  [${f.field}] ${f.message}`).join('\n')}`);
    console.log(`Saved → ${file}`);
  } else {
    console.log('Mode: extraction only (pass --full for review)\n');
    const result = await extractFromDocumentsApi(documents);
    const file   = await saveResult('extraction', codigoCompra, result);
    console.log(`Done — tokens: ${result.usage?.inputTokens ?? '?'} in / ${result.usage?.outputTokens ?? '?'} out`);
    console.log(`Missing: ${result.camposFaltantes.join(', ') || 'none'}`);
    console.log(`Saved → ${file}`);
  }
} catch (err) {
  const error = err as Error & { value?: unknown };
  const file  = await saveResult('error', codigoCompra, { error: error.message, value: error.value ?? null });
  console.error(`Failed: ${error.message}`);
  console.error(`Saved error → ${file}`);
}
