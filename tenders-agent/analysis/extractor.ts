import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
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

async function downloadDocument(doc: DocumentInput): Promise<{ name: string; buffer: Buffer }> {
  const res = await fetch(doc.url);
  if (!res.ok) throw new Error(`Failed to download "${doc.filename}": HTTP ${res.status}`);
  return { name: doc.filename, buffer: Buffer.from(await res.arrayBuffer()) };
}

export async function extractFromDocuments(documents: DocumentInput[]): Promise<ExtractionResult> {
  if (!documents.length) throw new Error('No documents provided for extraction');

  const downloaded = await Promise.all(documents.map(downloadDocument));

  const { object, usage } = await generateObject({
    model:    google(MODEL_ID),
    schema:   ExtractionSchema,
    messages: [
      {
        role:    'user',
        content: [
          ...downloaded.map(d => ({
            type:      'file' as const,
            data:      d.buffer,
            mediaType: 'application/pdf' as const,
          })),
          { type: 'text' as const, text: promptWithFileContext(downloaded.map(d => d.name)) },
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
