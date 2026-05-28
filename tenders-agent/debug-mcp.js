import 'dotenv/config';
import { MCPServerStreamableHttp } from '@openai/agents';

const server = new MCPServerStreamableHttp({
  name: 'airtable',
  url: 'https://mcp.airtable.com/mcp',
  requestInit: { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` } },
});

const BASE   = 'app3ZwUila8cvLYLu';
const TABLE  = 'tbldNqB7CyC0bii06';

async function call(tool, args) {
  console.log(`\n>>> ${tool}`);
  console.log('input:', JSON.stringify(args, null, 2));
  const result = await server.callTool(tool, args);
  const text = result?.map?.(r => r.text ?? JSON.stringify(r)).join('\n') ?? JSON.stringify(result);
  console.log('output:', text.slice(0, 1000));
  return text;
}

await server.connect();

// 1. Can we list tools at all?
const tools = await server.listTools();
console.log('\n=== Available tools ===');
console.log(tools.map(t => t.name).join(', '));

// 2. list-tables-for-base — do we get field IDs?
await call('list_tables_for_base', { baseId: BASE });

// 3. Bare minimum record fetch — no fieldIds, no filters, no sort
await call('list_records_for_table', { baseId: BASE, tableId: TABLE });

// 4. With pageSize only
await call('list_records_for_table', { baseId: BASE, tableId: TABLE, pageSize: 3 });

await server.close();
