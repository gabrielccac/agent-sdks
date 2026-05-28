import 'dotenv/config';
import { Agent, run, RunToolCallItem, RunToolCallOutputItem } from '@openai/agents';
import { agentInstructions } from './instructions.js';
import { tools } from './tools.js';

if (!process.env.AIRTABLE_TOKEN) { console.error('Missing AIRTABLE_TOKEN'); process.exit(1); }
if (!process.env.OPENAI_API_KEY)  { console.error('Missing OPENAI_API_KEY');  process.exit(1); }

const agent = new Agent({
  name: 'Tenders Agent',
  instructions: agentInstructions,
  tools,
});

const args    = process.argv.slice(2);
const verbose = args.includes('--verbose');
const query   = args.filter(a => a !== '--verbose').join(' ') || 'Liste todas as disputas.';

console.log(`Query: ${query}\n`);
const result = await run(agent, query);

if (verbose) {
  console.log('\n--- Tool calls ---');
  for (const item of result.newItems) {
    if (item instanceof RunToolCallItem && item.rawItem.type === 'function_call') {
      console.log(`\n[${item.rawItem.name}]`);
      console.log(' in:', JSON.stringify(JSON.parse(item.rawItem.arguments ?? '{}'), null, 2));
    }
    if (item instanceof RunToolCallOutputItem) {
      const s = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
      console.log(' out:', s.slice(0, 800), s.length > 800 ? '…' : '');
    }
  }
  console.log('------------------\n');
}

console.log('Response:\n', result.finalOutput);
