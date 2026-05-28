import type { ExtractionResult } from './extractor-api.js';
import { extractFromDocumentsApi } from './extractor-api.js';
import type { DocumentInput } from './prompt.js';
import type { ApiTenderData, ApiItem } from '../api/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = 'warning' | 'error';

export interface ReviewFlag {
  field:   string;
  message: string;
  severity: Severity;
}

export interface ReviewResult {
  extraction:   ExtractionResult;
  flags:        ReviewFlag[];
  reExtracted:  boolean;
  needsHuman:   boolean;
}

// Fields whose absence blocks downstream processing
const CRITICAL_FIELDS = new Set([
  'contato.endereco',
  'contato.cep',
  'prazoEntrega',
]);

// ---------------------------------------------------------------------------
// Item matching helpers
// ---------------------------------------------------------------------------

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstWords(s: string, n = 6): string {
  return normalizeText(s).split(' ').slice(0, n).join(' ');
}

// Loose similarity: do the first N words of the API description appear in the extracted description?
function descriptionsMatch(extracted: string, apiDesc: string): boolean {
  const needle = firstWords(apiDesc, 6);
  return normalizeText(extracted).includes(needle);
}

// ---------------------------------------------------------------------------
// Item validation
// ---------------------------------------------------------------------------

function validateItems(extraction: ExtractionResult, apiData: ApiTenderData): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const apiItems = apiData.items;
  const extItems = extraction.itens;

  if (extItems.length === 0) {
    flags.push({ field: 'itens', message: 'Nenhum item extraído dos documentos', severity: 'error' });
    return flags;
  }

  if (extItems.length !== apiItems.length) {
    flags.push({
      field:    'itens',
      message:  `Contagem diverge: documento extraiu ${extItems.length}, API retornou ${apiItems.length}`,
      severity: 'warning',
    });
  }

  // Build lookup by numero for fast matching
  const apiByNumero = new Map<number, ApiItem>();
  for (const item of apiItems) apiByNumero.set(item.numero, item);

  for (const extItem of extItems) {
    if (extItem.numero == null) continue;

    const apiItem = apiByNumero.get(extItem.numero);
    if (!apiItem) {
      flags.push({
        field:    `itens[${extItem.numero}].numero`,
        message:  `Item ${extItem.numero} não encontrado na API`,
        severity: 'warning',
      });
      continue;
    }

    // Name check
    if (!descriptionsMatch(extItem.descricao, apiItem.descricao)) {
      flags.push({
        field:    `itens[${extItem.numero}].descricao`,
        message:  `Item ${extItem.numero}: descrição diverge — doc: "${extItem.descricao.slice(0, 60)}" / API: "${apiItem.descricao.slice(0, 60)}"`,
        severity: 'warning',
      });
    }

    // Price check — only when both have a value
    if (extItem.valorUnitario != null && apiItem.valorUnitarioEstimado > 0) {
      const diff = Math.abs(extItem.valorUnitario - apiItem.valorUnitarioEstimado);
      const pct  = diff / apiItem.valorUnitarioEstimado;
      if (diff >= 0.01 && pct >= 0.01) {
        flags.push({
          field:    `itens[${extItem.numero}].valorUnitario`,
          message:  `Item ${extItem.numero}: preço diverge — doc: ${extItem.valorUnitario.toFixed(2)} / API: ${apiItem.valorUnitarioEstimado.toFixed(2)}`,
          severity: 'warning',
        });
      }
    }
  }

  // Group awareness: flag groups that require all items
  if (apiData.itemStructure === 'grouped' && apiData.groups) {
    for (const group of apiData.groups) {
      flags.push({
        field:    `grupos.${group.identificador}`,
        message:  `${group.identificador} (${group.items.length} itens): proposta deve cobrir todos os itens do grupo`,
        severity: 'warning',
      });
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

function gapFlags(extraction: ExtractionResult): { flags: ReviewFlag[]; criticalMissing: string[] } {
  const flags: ReviewFlag[] = [];
  const criticalMissing: string[] = [];

  for (const field of extraction.camposFaltantes) {
    const isCritical = CRITICAL_FIELDS.has(field);
    flags.push({
      field,
      message:  `Campo ausente nos documentos: ${field}`,
      severity: isCritical ? 'error' : 'warning',
    });
    if (isCritical) criticalMissing.push(field);
  }

  // Also flag empty itens as critical
  if (extraction.itens.length === 0 && !extraction.camposFaltantes.includes('itens')) {
    flags.push({ field: 'itens', message: 'Lista de itens vazia', severity: 'error' });
    criticalMissing.push('itens');
  }

  return { flags, criticalMissing };
}

// ---------------------------------------------------------------------------
// Focused re-extraction prompt
// ---------------------------------------------------------------------------

function buildFocusHint(existing: ExtractionResult, focusFields: string[]): string {
  return `
## Contexto: extração anterior
Uma primeira extração já foi feita. Campos críticos ainda faltando: ${focusFields.join(', ')}.

Extraction anterior (JSON):
${JSON.stringify({
  contato:          existing.contato,
  validadeProposta: existing.validadeProposta,
  prazoEntrega:     existing.prazoEntrega,
}, null, 2)}

## Sua tarefa
Releia os documentos com FOCO nos campos ausentes listados acima.
Procure por todas as seções de identificação do órgão, rodapés, cabeçalhos e qualquer menção de prazo.
Para os campos que já foram preenchidos, retorne o mesmo valor — não os altere.
Para os campos nulos, tente novamente com mais atenção.
`.trim();
}

// ---------------------------------------------------------------------------
// Merge: only fill null fields from re-extraction
// ---------------------------------------------------------------------------

function mergeExtractions(base: ExtractionResult, focused: ExtractionResult): ExtractionResult {
  return {
    ...base,
    contato: {
      nome:     base.contato.nome     ?? focused.contato.nome,
      email:    base.contato.email    ?? focused.contato.email,
      telefone: base.contato.telefone ?? focused.contato.telefone,
      orgao:    base.contato.orgao    ?? focused.contato.orgao,
      endereco: base.contato.endereco ?? focused.contato.endereco,
      cep:      base.contato.cep      ?? focused.contato.cep,
    },
    validadeProposta: base.validadeProposta ?? focused.validadeProposta,
    prazoEntrega:     base.prazoEntrega     ?? focused.prazoEntrega,
    // itens from focused only if base has none
    itens:            base.itens.length > 0 ? base.itens : focused.itens,
    // merge camposFaltantes — keep only fields still null after merge
    camposFaltantes:  focused.camposFaltantes.filter(f => {
      if (f === 'contato.nome')     return base.contato.nome     == null && focused.contato.nome     == null;
      if (f === 'contato.email')    return base.contato.email    == null && focused.contato.email    == null;
      if (f === 'contato.telefone') return base.contato.telefone == null && focused.contato.telefone == null;
      if (f === 'contato.orgao')    return base.contato.orgao    == null && focused.contato.orgao    == null;
      if (f === 'contato.endereco') return base.contato.endereco == null && focused.contato.endereco == null;
      if (f === 'contato.cep')      return base.contato.cep      == null && focused.contato.cep      == null;
      if (f === 'validadeProposta') return base.validadeProposta == null && focused.validadeProposta == null;
      if (f === 'prazoEntrega')     return base.prazoEntrega     == null && focused.prazoEntrega     == null;
      return true;
    }),
    usage: base.usage && focused.usage
      ? {
          inputTokens:  (base.usage.inputTokens  ?? 0) + (focused.usage.inputTokens  ?? 0),
          outputTokens: (base.usage.outputTokens ?? 0) + (focused.usage.outputTokens ?? 0),
          totalTokens:  (base.usage.totalTokens  ?? 0) + (focused.usage.totalTokens  ?? 0),
        }
      : base.usage ?? focused.usage,
  };
}

// ---------------------------------------------------------------------------
// Public: reviewExtraction
// ---------------------------------------------------------------------------

export async function reviewExtraction(
  extraction: ExtractionResult,
  documents:  DocumentInput[],
  apiData:    ApiTenderData,
): Promise<ReviewResult> {
  let current     = extraction;
  let reExtracted = false;

  // 1. Gap analysis
  const { flags: gapF, criticalMissing } = gapFlags(current);

  // 2. Focused re-extraction for critical gaps
  if (criticalMissing.length > 0) {
    const hint   = buildFocusHint(current, criticalMissing);
    const focused = await extractFromDocumentsApi(documents, hint);
    current      = mergeExtractions(current, focused);
    reExtracted  = true;
  }

  // 3. Item validation against API
  const itemFlags = validateItems(current, apiData);

  // 4. Recompute gap flags after potential re-extraction
  const { flags: finalGapFlags } = gapFlags(current);

  const allFlags   = [...finalGapFlags, ...itemFlags];
  const needsHuman = allFlags.some(f => f.severity === 'error');

  return { extraction: current, flags: allFlags, reExtracted, needsHuman };
}
