import 'dotenv/config';
import { MCPServerStreamableHttp } from '@openai/agents';

const server = new MCPServerStreamableHttp({
  name: 'airtable',
  url: 'https://mcp.airtable.com/mcp',
  requestInit: { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` } },
});

const BASE  = 'app3ZwUila8cvLYLu';
const TABLE = 'tbldNqB7CyC0bii06';

async function call(tool, args = {}) {
  console.log(`\n>>> ${tool}`);
  const result = await server.callTool(tool, args);
  // Print raw structure so we can see exactly what comes back
  console.log('raw:', JSON.stringify(result, null, 2));
}

await server.connect();

// 1. ping
await call('ping');

// 2. What bases does this token actually see?
await call('list_bases');

// 3. What workspaces?
await call('list_workspaces');

// 4. list_tables_for_base with our base
await call('list_tables_for_base', { baseId: BASE });

// 5. bare record fetch
await call('list_records_for_table', { baseId: BASE, tableId: TABLE });

await server.close();
