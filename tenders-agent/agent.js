import 'dotenv/config';
import { Agent, MCPServerStreamableHttp, run } from '@openai/agents';
import { agentInstructions } from './instructions.js';

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!AIRTABLE_TOKEN) {
  console.error('Missing AIRTABLE_TOKEN environment variable');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable');
  process.exit(1);
}

async function main() {
  const airtableMCP = new MCPServerStreamableHttp({
    name: 'airtable',
    url: 'https://mcp.airtable.com/mcp',
    requestInit: {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    },
  });

  const agent = new Agent({
    name: 'Tenders Agent',
    instructions: agentInstructions,
    mcpServers: [airtableMCP],
  });

  const query = process.argv[2] ?? 'Liste todas as disputas cadastradas.';

  console.log(`Query: ${query}\n`);

  try {
    await airtableMCP.connect();

    const result = await run(agent, query);
    console.log('Response:\n', result.finalOutput);
  } finally {
    await airtableMCP.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
