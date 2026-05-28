export const MODEL_ID = 'gemini-2.5-flash';

export const EXTRACTION_PROMPT = `Você está extraindo dados estruturados de editais e termos de referência de licitações públicas brasileiras.

REGRA FUNDAMENTAL: Extraia APENAS informações explicitamente presentes nos documentos.
NUNCA invente, estime ou infira valores ausentes. Se um campo não constar no documento, retorne null e inclua seu nome em camposFaltantes.

Campos a extrair:
- contato: fiscal técnico ou servidor responsável pela licitação (NÃO o ordenador de despesas) — nome, e-mail, telefone, órgão completo, endereço e CEP
- itens: cada item/produto/serviço com descrição, quantidade, unidade de medida, especificações técnicas completas (texto integral, sem resumir) e valor unitário estimado se declarado
- validadeProposta: prazo de validade da proposta (ex: "60 dias")
- prazoEntrega: prazo de entrega ou execução (ex: "30 dias após emissão da ordem de serviço")
- anexos: para cada documento referenciado ou exigido, informe o título como aparece no texto E o nome do arquivo PDF onde foi encontrado
- camposFaltantes: nomes exatos dos campos que não foram encontrados nos documentos`;

export function promptWithFileContext(filenames: string[]): string {
  return `Documentos (${filenames.length}): ${filenames.join(', ')}.\n\n${EXTRACTION_PROMPT}`;
}

export interface DocumentInput {
  filename: string;
  url:      string;
}
