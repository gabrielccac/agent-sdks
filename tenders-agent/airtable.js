const BASE_ID  = 'app3ZwUila8cvLYLu';
const TABLE_ID = 'tbldNqB7CyC0bii06';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const DEFAULT_FIELDS = [
  'CodigoCompra', 'Modalidade', 'Descricao', 'Status',
  'Preco', 'DataLeilao', 'Orgao', 'UF', 'URL', 'PrazoEntrega',
];

async function airtableFetch(params) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v.forEach(f => url.searchParams.append(`${k}[]`, f));
    } else if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

function fieldsParam(extra = []) {
  return [...new Set([...DEFAULT_FIELDS, ...extra])];
}

export const airtableTools = {
  list_tenders: {
    description: 'List tenders with optional filters. Use for browsing, filtering by status, UF, date range, or price.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'array',
          items: { type: 'string', enum: ['Pendente', 'Análise', 'Monitoramento', 'Homologada', 'Derrota'] },
          description: 'Filter by one or more Status values.',
        },
        uf: { type: 'string', description: 'Filter by state abbreviation, e.g. SP.' },
        date_mode: {
          type: 'string',
          enum: ['today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth', 'pastWeek', 'pastMonth'],
          description: 'Filter DataLeilao by relative date window.',
        },
        max_price: { type: 'number', description: 'Only return tenders with Preco <= this value.' },
        min_price: { type: 'number', description: 'Only return tenders with Preco >= this value.' },
        limit: { type: 'number', description: 'Max records to return. Defaults to 50.' },
      },
    },
    async execute({ status, uf, date_mode, max_price, min_price, limit = 50 }) {
      const conditions = [];

      if (status?.length) {
        const clause = status.map(s => `{Status}="${s}"`).join(',');
        conditions.push(status.length === 1 ? `{Status}="${status[0]}"` : `OR(${clause})`);
      }
      if (uf) conditions.push(`{UF}="${uf}"`);
      if (date_mode) conditions.push(`IS_SAME({DataLeilao},${dateModeFormula(date_mode)})`);
      if (max_price != null) conditions.push(`{Preco}<=${max_price}`);
      if (min_price != null) conditions.push(`{Preco}>=${min_price}`);

      const filterByFormula = conditions.length > 1
        ? `AND(${conditions.join(',')})`
        : conditions[0] ?? '';

      const params = {
        fields: fieldsParam(),
        pageSize: limit,
        'sort[0][field]': 'DataLeilao',
        'sort[0][direction]': 'asc',
      };
      if (filterByFormula) params.filterByFormula = filterByFormula;

      const data = await airtableFetch(params);
      const records = data.records.map(formatRecord);
      if (!records.length) return 'Nenhuma disputa encontrada com os critérios fornecidos.';
      return { count: records.length, records };
    },
  },

  search_tenders: {
    description: 'Search tenders by keyword in Descricao, Orgao, or CodigoCompra.',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search term.' },
        limit: { type: 'number', description: 'Max records to return. Defaults to 20.' },
      },
    },
    async execute({ query, limit = 20 }) {
      const formula = `OR(
        SEARCH("${query}",LOWER({Descricao})),
        SEARCH("${query}",LOWER({Orgao})),
        SEARCH("${query}",LOWER({CodigoCompra}))
      )`;
      const data = await airtableFetch({
        fields: fieldsParam(),
        filterByFormula: formula,
        pageSize: limit,
      });
      const records = data.records.map(formatRecord);
      if (!records.length) return 'Nenhuma disputa encontrada para esse termo de busca.';
      return { count: records.length, records };
    },
  },

  get_tender: {
    description: 'Get full details of a single tender by its CodigoCompra.',
    parameters: {
      type: 'object',
      required: ['codigo'],
      properties: {
        codigo: { type: 'string', description: 'The CodigoCompra value.' },
      },
    },
    async execute({ codigo }) {
      const data = await airtableFetch({
        filterByFormula: `{CodigoCompra}="${codigo}"`,
        pageSize: 1,
      });
      if (!data.records.length) return `Nenhuma disputa encontrada com CodigoCompra "${codigo}".`;
      return formatRecord(data.records[0]);
    },
  },
};

function dateModeFormula(mode) {
  // Use IS_SAME with explicit date strings (Brazil UTC-3) rather than
  // Airtable's TODAY() to avoid server-side timezone ambiguity.
  const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = nowBR.getUTCFullYear(), mo = nowBR.getUTCMonth(), d = nowBR.getUTCDate();

  const ymd = (dt) => dt.toISOString().slice(0, 10);
  const day = (n)  => new Date(Date.UTC(y, mo, d + n));
  const mon = (n)  => new Date(Date.UTC(y, mo + n, 1));

  const ref = {
    today:     [day(0),    'day'],
    tomorrow:  [day(1),    'day'],
    yesterday: [day(-1),   'day'],
    thisWeek:  [day(0),    'week'],
    pastWeek:  [day(-7),   'week'],
    nextWeek:  [day(7),    'week'],
    thisMonth: [day(0),    'month'],
    pastMonth: [mon(-1),   'month'],
    nextMonth: [mon(1),    'month'],
  };

  const [date, unit] = ref[mode] ?? ref.today;
  return `IS_SAME({DataLeilao},'${ymd(date)}','${unit}')`;
}

function formatRecord(r) {
  const f = r.fields;
  return {
    id: r.id,
    CodigoCompra:     f.CodigoCompra,
    Modalidade:       f.Modalidade?.name ?? f.Modalidade,
    Descricao:        f.Descricao,
    Status:           f.Status?.name ?? f.Status,
    Preco:            f.Preco,
    DataLeilao:       f.DataLeilao,
    Orgao:            f.Orgao,
    UF:               f.UF,
    URL:              f.URL,
    PrazoEntrega:     f.PrazoEntrega,
  };
}
