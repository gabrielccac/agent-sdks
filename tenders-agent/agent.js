import 'dotenv/config';
import { Agent, MCPServerStreamableHttp, run } from '@openai/agents';

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

const BASE_ID = 'app3ZwUila8cvLYLu';
const TABLES = {
  disputas: 'tbldNqB7CyC0bii06',
  // itens:     'tblBxmQU0XsSBjSdR',  (linked from Disputas.Itens — add more tables here as needed)
};

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
    instructions: `You are a helpful assistant for managing public tender (licitação) data stored in Airtable.
All data is in Portuguese — always respond in Portuguese unless the user writes in another language.

## Airtable coordinates
- Base ID: ${BASE_ID}
- Main table: "Disputas" (id: ${TABLES.disputas})

## Table: Disputas
Each record is a public tender the company is tracking or participating in.

| Field            | Type               | Description |
|------------------|--------------------|-------------|
| CodigoCompra     | text               | Unique purchase/tender code |
| Modalidade       | singleSelect       | Tender type: "Dispensa Eletrônica" or "Pregão Eletrônico" |
| Descricao        | text               | Full description of what is being procured |
| Status           | singleSelect       | Current status: Análise, Pendente, Homologada, Monitoramento, Derrota |
| Preco            | currency (BRL)     | Reference or winning price |
| URL              | url                | Link to the tender on the procurement portal |
| DataLeilao       | dateTime           | Auction/session date and time |
| Anexos           | attachments        | Uploaded documents (edital, etc.) |
| UASG             | text               | Código UASG da unidade compradora |
| Orgao            | text               | Name of the buying public body |
| UF               | text               | State (e.g. SP, RJ) |
| Endereco         | text               | Address of the buying body |
| CEP              | text               | Postal code |
| PrazoEntrega     | text               | Delivery deadline |
| Itens            | linkedRecords      | Line items linked to table tblBxmQU0XsSBjSdR |
| Email            | email              | Contact email |
| Telefone         | phone              | Contact phone |
| ValidadeProposta | text               | Proposal validity period |

## Instructions
- Always use the Base ID and Table ID above — never try to discover them.
- When filtering by Status, use exact values: Análise, Pendente, Homologada, Monitoramento, Derrota.
- When the user asks for "abertas" or "em andamento", filter for Status = Análise or Monitoramento.
- Dates are stored in ISO 8601. Format them as DD/MM/YYYY when displaying.
- Prices are in BRL — format as R$ X.XXX,XX when displaying.
- Always fetch fresh data before answering.`,
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
