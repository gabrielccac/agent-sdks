import { extractFromDocumentsApi } from './extractor-api.js';
import { reviewExtraction } from './reviewer.js';
import type { DocumentInput } from './prompt.js';
import type { ExtractionResult } from './extractor-api.js';
import type { ReviewResult } from './reviewer.js';
import type { ApiTenderData } from '../api/types.js';

export interface WorkflowInput {
  codigoCompra: string;
  documents:    DocumentInput[];
  apiData:      ApiTenderData;
}

export interface WorkflowResult {
  codigoCompra: string;
  extraction:   ExtractionResult;
  review:       ReviewResult;
  status:       'complete' | 'incomplete' | 'needs_human';
}

export async function runAnalysisWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const { codigoCompra, documents, apiData } = input;

  const extraction = await extractFromDocumentsApi(documents);
  const review     = await reviewExtraction(extraction, documents, apiData);

  // Enrich extraction with API fields not in documents
  const enriched: ExtractionResult = {
    ...review.extraction,
    // API metadata available as top-level enrichment — stored in review for callers
  };

  const errorCount   = review.flags.filter(f => f.severity === 'error').length;
  const warningCount = review.flags.filter(f => f.severity === 'warning').length;

  const status: WorkflowResult['status'] = review.needsHuman
    ? 'needs_human'
    : warningCount > 0
      ? 'incomplete'
      : 'complete';

  return { codigoCompra, extraction: enriched, review, status };
}
