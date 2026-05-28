import { extractFromDocuments, type DocumentInput } from './extractor.js';
import type { ExtractionResult } from './extractor.js';

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

  // Step 1: extract from documents
  const extraction = await extractFromDocuments(documents);

  const gaps = extraction.camposFaltantes;

  // TODO: Step 2 — re-run extraction with focused prompt on specific missing fields
  // TODO: Step 3 — cross-check extracted fields against Airtable tender metadata
  // TODO: Step 4 — if gaps remain: flag for human review or trigger email to contractor
  // TODO: Step 5 — write enriched data back to Airtable

  const status = gaps.length === 0
    ? 'complete'
    : gaps.length <= 2
      ? 'incomplete'
      : 'needs_review';

  return { codigoCompra, extraction, status, gaps };
}
