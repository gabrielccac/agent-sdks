import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BASE_ID = 'app3ZwUila8cvLYLu';

export const TABLES = {
  disputas: 'tbldNqB7CyC0bii06',
  // itens:     'tblBxmQU0XsSBjSdR',
  // invoices:  'tbl...',
  // suppliers: 'tbl...',
};

export const DEFAULT_FIELDS = [
  'CodigoCompra', 'Modalidade', 'Descricao', 'Status',
  'Preco', 'DataLeilao', 'Orgao', 'UF', 'URL', 'PrazoEntrega',
];

// Field IDs and singleSelect option IDs for the Disputas table.
// Fill these in from: npx @airtable/mcp-cli get-table-schema --baseId app3ZwUila8cvLYLu --tableIds tbldNqB7CyC0bii06
const FIELD_IDS = {
  status:     'fld_STATUS_ID_HERE',
  dataLeilao: 'fld_DATA_LEILAO_ID_HERE',
};

const STATUS_OPTION_IDS = {
  pendente:      'sel_PENDENTE_ID_HERE',
  analise:       'sel_ANALISE_ID_HERE',
  monitoramento: 'sel_MONITORAMENTO_ID_HERE',
  homologada:    'sel_HOMOLOGADA_ID_HERE',
  derrota:       'sel_DERROTA_ID_HERE',
};

const template = readFileSync(join(__dirname, 'instructions.md'), 'utf8');

export const agentInstructions = template
  .replaceAll('{{BASE_ID}}',           BASE_ID)
  .replaceAll('{{TABLE_DISPUTAS}}',    TABLES.disputas)
  .replaceAll('{{DEFAULT_FIELDS}}',    JSON.stringify(DEFAULT_FIELDS))
  .replaceAll('{{FLD_STATUS}}',        FIELD_IDS.status)
  .replaceAll('{{FLD_DATA_LEILAO}}',   FIELD_IDS.dataLeilao)
  .replaceAll('{{SEL_PENDENTE}}',      STATUS_OPTION_IDS.pendente)
  .replaceAll('{{SEL_ANALISE}}',       STATUS_OPTION_IDS.analise)
  .replaceAll('{{SEL_MONITORAMENTO}}', STATUS_OPTION_IDS.monitoramento)
  .replaceAll('{{SEL_HOMOLOGADA}}',    STATUS_OPTION_IDS.homologada)
  .replaceAll('{{SEL_DERROTA}}',       STATUS_OPTION_IDS.derrota);
