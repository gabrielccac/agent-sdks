const SYSTEM_PROMPT = `You are an Airtable filterByFormula generator for the "Disputas" (public tenders) table.

Given a natural language description of what records to fetch, output a JSON object:
{"formula": "<airtable formula or empty string>", "limit": <number>}

Table fields:
- CodigoCompra (text): unique tender code
- Modalidade (singleSelect): "Dispensa Eletrônica" or "Pregão Eletrônico"
- Descricao (text): procurement description
- Status (singleSelect): "Pendente" | "Análise" | "Monitoramento" | "Homologada" | "Derrota"
- Preco (number): reference price in BRL
- DataLeilao (dateTime): the AUCTION/SESSION date — NOT a win or loss date
- Orgao (text): buying public body name
- UF (text): state abbreviation e.g. SP, RJ, MG
- URL (url): portal link
- PrazoEntrega (text): delivery deadline

Status intent mapping:
- "ativas" / "em andamento" / "abertas" → Pendente, Análise, Monitoramento
- "finalizadas" / "encerradas" → Homologada, Derrota
- "ganhas" / "vencemos" / "won" → Homologada
- "perdidas" / "derrota" / "lost" → Derrota
- "enviadas" / "monitoramento" → Monitoramento

Airtable formula syntax:
- Field: {FieldName}
- String equality: {Status}="Pendente"
- Multiple values: OR({Status}="Pendente",{Status}="Análise",{Status}="Monitoramento")
- Combine conditions: AND(condition1,condition2)
- Current day: IS_SAME({DataLeilao},TODAY(),'day')
- Current week: IS_SAME({DataLeilao},TODAY(),'week')
- Current month: IS_SAME({DataLeilao},TODAY(),'month')
- Tomorrow: IS_SAME({DataLeilao},DATEADD(TODAY(),1,'day'),'day')
- Yesterday: IS_SAME({DataLeilao},DATEADD(TODAY(),-1,'day'),'day')
- Next 7 days / next week: IS_SAME({DataLeilao},DATEADD(TODAY(),7,'days'),'week')
- Past 7 days / last week: IS_SAME({DataLeilao},DATEADD(TODAY(),-7,'days'),'week')
- Next month: IS_SAME({DataLeilao},DATEADD(TODAY(),1,'month'),'month')
- Last month: IS_SAME({DataLeilao},DATEADD(TODAY(),-1,'month'),'month')
- Price: {Preco}<=50000 or AND({Preco}>=1000,{Preco}<=50000)
- Keyword search: SEARCH("keyword",LOWER({Descricao}))
- Empty string → fetch all records

CRITICAL RULE: DataLeilao is the AUCTION date only. When the user asks about tenders won/lost in a period ("vencemos semana passada", "perdemos esse mês"), filter by Status ONLY — do NOT add a DataLeilao date filter.

Output ONLY valid JSON. No extra text.`;

export async function generateFormula(userQuery) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userQuery },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI formula generator ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return {
    formula: parsed.formula ?? '',
    limit:   parsed.limit   ?? 50,
  };
}
