import 'dotenv/config';
import { Agent, tool, run } from '@openai/agents';
import { z } from 'zod';
import { agentInstructions } from './instructions.js';
import { airtableTools } from './airtable.js';

if (!process.env.AIRTABLE_TOKEN) { console.error('Missing AIRTABLE_TOKEN'); process.exit(1); }
if (!process.env.OPENAI_API_KEY)  { console.error('Missing OPENAI_API_KEY');  process.exit(1); }

const statusEnum = z.enum(['Pendente', 'Análise', 'Monitoramento', 'Homologada', 'Derrota']);
const dateModeEnum = z.enum(['today','tomorrow','thisWeek','nextWeek','thisMonth','nextMonth','pastWeek','pastMonth']);

const tools = [
  tool({
    name: 'list_tenders',
    description: airtableTools.list_tenders.description,
    parameters: z.object({
      status:     z.array(statusEnum).optional(),
      uf:         z.string().optional(),
      date_mode:  dateModeEnum.optional(),
      max_price:  z.number().optional(),
      min_price:  z.number().optional(),
      limit:      z.number().optional(),
    }),
    execute: (args) => airtableTools.list_tenders.execute(args),
  }),

  tool({
    name: 'search_tenders',
    description: airtableTools.search_tenders.description,
    parameters: z.object({
      query: z.string(),
      limit: z.number().optional(),
    }),
    execute: (args) => airtableTools.search_tenders.execute(args),
  }),

  tool({
    name: 'get_tender',
    description: airtableTools.get_tender.description,
    parameters: z.object({
      codigo: z.string(),
    }),
    execute: (args) => airtableTools.get_tender.execute(args),
  }),
];

const agent = new Agent({
  name: 'Tenders Agent',
  instructions: agentInstructions,
  tools,
});

const args  = process.argv.slice(2);
const verbose = args.includes('--verbose');
const query = args.filter(a => a !== '--verbose').join(' ') || 'Liste todas as disputas cadastradas.';

console.log(`Query: ${query}\n`);

const result = await run(agent, query);

if (verbose) {
  console.log('\n--- Tool calls ---');
  for (const item of result.newItems) {
    if (item.type === 'tool_call_item') {
      const raw = item.rawItem;
      console.log(`\n[${raw.name}]`);
      console.log('  input:', JSON.stringify(raw.arguments ? JSON.parse(raw.arguments) : {}, null, 2));
    }
    if (item.type === 'tool_call_output_item') {
      const str = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
      console.log('  output:', str.slice(0, 600), str.length > 600 ? '...' : '');
    }
  }
  console.log('------------------\n');
}

console.log('Response:\n', result.finalOutput);
