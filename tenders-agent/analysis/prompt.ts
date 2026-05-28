export const MODEL_ID = 'gemini-2.5-flash';

export const EXTRACTION_PROMPT = `Você é um especialista em licitações públicas brasileiras. Extraia dados estruturados dos documentos anexados.

## Regra absoluta
Extraia APENAS o que está explicitamente escrito nos documentos.
Nunca invente, estime ou complete com conhecimento externo.
Se uma informação não constar no documento: retorne null para o campo e adicione seu nome em camposFaltantes.

## Processo
1. Leia todos os documentos na íntegra antes de extrair qualquer campo
2. Para cada campo, localize a informação no texto — se não encontrar, marque como ausente
3. Copie especificações técnicas na íntegra, sem resumir ou reformular

## Atenção
- contato: fiscal técnico ou servidor responsável — não o ordenador de despesas
- camposFaltantes: use os nomes exatos dos campos (ex: "contato.email", "prazoEntrega")`;

export function promptWithFileContext(filenames: string[]): string {
  return `Documentos (${filenames.length}): ${filenames.join(', ')}.\n\n${EXTRACTION_PROMPT}`;
}

export interface DocumentInput {
  filename: string;
  url:      string;
}
