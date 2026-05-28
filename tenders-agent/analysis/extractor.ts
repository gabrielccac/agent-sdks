import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { ExtractionSchema, type Extraction } from './schema.js';

const MODEL_ID = 'gemini-2.0-flash';

const EXTRACTION_PROMPT = `Você é um assistente de extração de dados de editais e termos de referência de licitações públicas brasileiras.

Extraia APENAS informações explicitamente declaradas nos documentos anexados.
NÃO infira, estime ou invente nenhum valor.
Se um campo não for encontrado nos documentos, retorne null para esse campo e inclua o nome do campo em camposFaltantes.

Extraia:
- contato: dados do responsável/fiscal do órgão comprador (nome, e-mail, telefone, órgão, endereço)
- itens: todos os itens/produtos/serviços solicitados com quantidades, unidades e especificações técnicas
- validadeProposta: prazo de validade da proposta conforme exigido no edital
- prazoEntrega: prazo de entrega ou execução do contrato
- anexos: nomes dos documentos referenciados ou exigidos
- camposFaltantes: lista dos campos acima que não constam nos documentos`;

export interface DocumentInput {
  filename: string;
  url:      string;
}

export interface ExtractionResult extends Extraction {
  usage?: {
    inputTokens?:  number;
    outputTokens?: number;
    totalTokens?:  number;
  };
}

async function downloadDocument(doc: DocumentInput): Promise<{ name: string; buffer: Buffer }> {
  const res = await fetch(doc.url);
  if (!res.ok) throw new Error(`Failed to download "${doc.filename}": HTTP ${res.status}`);
  return { name: doc.filename, buffer: Buffer.from(await res.arrayBuffer()) };
}

export async function extractFromDocuments(documents: DocumentInput[]): Promise<ExtractionResult> {
  if (!documents.length) throw new Error('No documents provided for extraction');

  const downloaded = await Promise.all(documents.map(downloadDocument));

  const fileParts = downloaded.map(d => ({
    type:      'file' as const,
    data:      d.buffer,
    mediaType: 'application/pdf' as const,
  }));

  const contextLine = `Documentos (${downloaded.length}): ${downloaded.map(d => d.name).join(', ')}.\n\n`;

  const { object, usage } = await generateObject({
    model:    google(MODEL_ID),
    schema:   ExtractionSchema,
    messages: [
      {
        role:    'user',
        content: [
          ...fileParts,
          { type: 'text' as const, text: contextLine + EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  return {
    ...object,
    usage: usage
      ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }
      : undefined,
  };
}
