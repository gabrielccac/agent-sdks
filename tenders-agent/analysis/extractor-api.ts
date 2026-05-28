import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ExtractionSchema, type Extraction } from './schema.js';
import { MODEL_ID, promptWithFileContext, type DocumentInput } from './prompt.js';

export type { DocumentInput };

export interface ExtractionResult extends Extraction {
  usage?: {
    inputTokens?:  number;
    outputTokens?: number;
    totalTokens?:  number;
  };
}

// JSON schema passed to Gemini's native responseSchema.
// Kept in sync with schema.ts manually — source of truth is the Zod schema.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    contato: {
      type: SchemaType.OBJECT,
      properties: {
        nome:     { type: SchemaType.STRING, nullable: true, description: 'Nome do responsável ou fiscal' },
        email:    { type: SchemaType.STRING, nullable: true, description: 'E-mail de contato' },
        telefone: { type: SchemaType.STRING, nullable: true, description: 'Telefone de contato' },
        orgao:    { type: SchemaType.STRING, nullable: true, description: 'Nome do órgão comprador' },
        endereco: { type: SchemaType.STRING, nullable: true, description: 'Endereço do órgão sem o CEP' },
        cep:      { type: SchemaType.STRING, nullable: true, description: 'CEP no formato XXXXX-XXX, sem pontos' },
      },
    },
    itens: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          numero:        { type: SchemaType.NUMBER, nullable: true, description: 'Número ou índice do item conforme aparece na tabela do documento' },
          descricao:     { type: SchemaType.STRING, description: 'Descrição completa do item' },
          quantidade:    { type: SchemaType.NUMBER, description: 'Quantidade solicitada' },
          unidade:       { type: SchemaType.STRING, description: 'Unidade de medida' },
          especificacoes: { type: SchemaType.STRING, description: 'Texto integral das especificações técnicas, sem resumir' },
          valorUnitario: { type: SchemaType.NUMBER, nullable: true, description: 'Valor unitário estimado se declarado no documento' },
        },
        required: ['descricao', 'quantidade', 'unidade', 'especificacoes'],
      },
    },
    validadeProposta: { type: SchemaType.STRING, nullable: true, description: 'Prazo de validade da proposta' },
    prazoEntrega:     { type: SchemaType.STRING, nullable: true, description: 'Prazo de entrega ou execução' },
    anexos: {
      type: SchemaType.ARRAY,
      description: 'Modelos e templates que o licitante deve preencher e entregar. NÃO listar os arquivos do processo em si.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          titulo:  { type: SchemaType.STRING, description: 'Nome do modelo/template como aparece no documento (ex: "ANEXO I - Modelo de Proposta", "Planilha de Preços")' },
          arquivo: { type: SchemaType.STRING, nullable: true, description: 'Nome do arquivo PDF que contém este modelo, se identificável' },
        },
        required: ['titulo'],
      },
    },
    camposFaltantes:  { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['contato', 'itens', 'validadeProposta', 'prazoEntrega', 'anexos', 'camposFaltantes'],
};

async function downloadDocument(doc: DocumentInput): Promise<{ name: string; base64: string }> {
  const res = await fetch(doc.url);
  if (!res.ok) throw new Error(`Failed to download "${doc.filename}": HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  return { name: doc.filename, base64: Buffer.from(buffer).toString('base64') };
}

export async function extractFromDocumentsApi(documents: DocumentInput[]): Promise<ExtractionResult> {
  if (!documents.length) throw new Error('No documents provided for extraction');

  const downloaded = await Promise.all(documents.map(downloadDocument));

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema:   RESPONSE_SCHEMA,
    },
  });

  const result = await model.generateContent([
    ...downloaded.map(d => ({
      inlineData: { mimeType: 'application/pdf' as const, data: d.base64 },
    })),
    { text: promptWithFileContext(downloaded.map(d => d.name)) },
  ]);

  const raw = result.response.text();
  const parsed = ExtractionSchema.parse(JSON.parse(raw));

  const meta = result.response.usageMetadata;
  return {
    ...parsed,
    usage: meta
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount, totalTokens: meta.totalTokenCount }
      : undefined,
  };
}
