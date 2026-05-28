import 'dotenv/config';

const BASE_ID = 'app3ZwUila8cvLYLu';
const TOKEN = process.env.AIRTABLE_TOKEN;

if (!TOKEN) {
  console.error('Set AIRTABLE_TOKEN in your .env file');
  process.exit(1);
}

const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});

if (!res.ok) {
  console.error(`Error ${res.status}:`, await res.text());
  process.exit(1);
}

const { tables } = await res.json();

for (const table of tables) {
  console.log(`\nTable: "${table.name}" (id: ${table.id})`);
  for (const field of table.fields) {
    let extra = '';
    if (field.options?.choices) {
      const choices = field.options.choices.slice(0, 6).map(c => c.name).join(', ');
      extra = `  → [${choices}]`;
    } else if (field.options?.linkedTableId) {
      extra = `  → linked: ${field.options.linkedTableId}`;
    }
    console.log(`  - "${field.name}" (${field.type})${extra}`);
  }
}
