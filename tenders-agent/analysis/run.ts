import 'dotenv/config';
import { airtableFetch } from '../tools/airtable.js';
import { runAnalysisWorkflow } from './workflow.js';

const codigoCompra = process.argv[2];
if (!codigoCompra) {
  console.error('Usage: tsx analysis/run.ts <CodigoCompra>');
  process.exit(1);
}

if (!process.env.AIRTABLE_TOKEN)           { console.error('Missing AIRTABLE_TOKEN');           process.exit(1); }
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) { console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY'); process.exit(1); }

console.log(`Fetching documents for: ${codigoCompra}\n`);

const data = await airtableFetch({
  filterByFormula: `{CodigoCompra}="${codigoCompra}"`,
  fields:          ['CodigoCompra', 'Anexos'],
  pageSize:        '1',
});

if (!data.records.length) {
  console.error(`No tender found with CodigoCompra "${codigoCompra}"`);
  process.exit(1);
}

const anexos = data.records[0].fields.Anexos;
if (!anexos?.length) {
  console.error(`No attachments found for "${codigoCompra}"`);
  process.exit(1);
}

console.log(`Found ${anexos.length} document(s): ${anexos.map(a => a.filename).join(', ')}\n`);

const result = await runAnalysisWorkflow({
  codigoCompra,
  documents: anexos.map(a => ({ filename: a.filename, url: a.url })),
});

console.log('Status:   ', result.status);
console.log('Gaps:     ', result.gaps.length ? result.gaps.join(', ') : 'none');
console.log('\nExtraction:');
console.log(JSON.stringify(result.extraction, null, 2));
