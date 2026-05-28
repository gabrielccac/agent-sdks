import 'dotenv/config';

const BASE  = 'app3ZwUila8cvLYLu';
const TABLE = 'tbldNqB7CyC0bii06';
const TOKEN = process.env.AIRTABLE_TOKEN;

async function query(label, formula) {
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  if (formula) url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('pageSize', '5');
  url.searchParams.append('fields[]', 'CodigoCompra');
  url.searchParams.append('fields[]', 'Status');
  url.searchParams.append('fields[]', 'DataLeilao');

  const res  = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await res.json();
  console.log(`\n[${label}] formula: ${formula ?? '(none)'}`);
  if (data.error) { console.log('ERROR:', data.error); return; }
  console.log(`records: ${data.records.length}`);
  data.records.forEach(r => console.log(' -', r.fields.CodigoCompra, '|', r.fields.DataLeilao, '|', r.fields.Status?.name));
}

// 1. No filter — do we get any records at all?
await query('no filter', null);

// 2. Airtable native TODAY() — server evaluates this
await query('IS_SAME today (native)', "IS_SAME({DataLeilao},TODAY(),'day')");

// 3. Hardcoded date string
await query('IS_SAME today (hardcoded)', "IS_SAME({DataLeilao},'2026-05-28','day')");

// 4. Status filter — sanity check
await query('status=Pendente', '{Status}="Pendente"');
