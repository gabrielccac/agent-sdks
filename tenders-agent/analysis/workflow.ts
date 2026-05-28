import { extractFromDocumentsApi } from './extractor-api.js';
import type { DocumentInput } from './prompt.js';
import type { ExtractionResult } from './extractor-api.js';

export interface WorkflowInput {
  codigoCompra: string;
  documents:    DocumentInput[];
}

export interface WorkflowResult {
  codigoCompra: string;
  extraction:   ExtractionResult;
  status:       'complete' | 'incomplete' | 'needs_review';
  gaps:         string[];
}

export async function runAnalysisWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const { codigoCompra, documents } = input;

  const extraction = await extractFromDocumentsApi(documents);
  const gaps       = extraction.camposFaltantes;

  // TODO: reviewer — check gaps, re-extract with focus, enrich with metadata
  // TODO: write enriched result back to Airtable

  const status = gaps.length === 0
    ? 'complete'
    : gaps.length <= 2
      ? 'incomplete'
      : 'needs_review';

  return { codigoCompra, extraction, status, gaps };
}
