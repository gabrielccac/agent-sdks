import type { ApiItem, ApiGroup, ApiTenderData } from './types.js';

const BASE = 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/public/v1';
const PAGE_SIZE = 500; // large enough to fetch all items in one call

// ---------------------------------------------------------------------------
// Raw API shapes
// ---------------------------------------------------------------------------

interface RawTender {
  valorTotalEstimado:    number;
  informacaoComplementar: string | null;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao:  { nomeUnidade: string };
}

interface RawItem {
  numero:               number;
  tipo:                 'I' | 'G' | 'S';
  identificador:        string;
  descricao:            string;
  quantidadeSolicitada?: number;
  valorEstimadoUnitario?: number;
  valorEstimadoTotal?:  number;
  qtdeItensDoGrupo?:    number;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ComprasNet ${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function paginationParams() {
  return { tamanhoPagina: String(PAGE_SIZE), pagina: '0' };
}

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

export async function fetchComprasNetData(codigoCompra: string): Promise<ApiTenderData> {
  const [tender, rawItems] = await Promise.all([
    get<RawTender>(`/compras/${codigoCompra}`),
    get<RawItem[]>(`/compras/${codigoCompra}/itens`, paginationParams()),
  ]);

  const hasGroups = rawItems.some(i => i.tipo === 'G');

  if (hasGroups) {
    const groups = rawItems.filter(i => i.tipo === 'G');

    const groupItems = await Promise.all(
      groups.map(g =>
        get<RawItem[]>(`/compras/${codigoCompra}/itens/${g.numero}/itens-grupo`, paginationParams())
      )
    );

    const apiGroups: ApiGroup[] = groups.map((g, idx) => ({
      identificador:    g.identificador,
      descricao:        g.descricao,
      valorEstimadoTotal: g.valorEstimadoTotal ?? 0,
      items: groupItems[idx].map(i => normalizeItem(i, g.identificador)),
    }));

    const flatItems = apiGroups.flatMap(g => g.items);

    return {
      codigoCompra,
      cnpj:                  tender.orgaoEntidade.cnpj,
      orgao:                 tender.unidadeOrgao.nomeUnidade,
      informacaoComplementar: tender.informacaoComplementar,
      valorTotalEstimado:    tender.valorTotalEstimado,
      itemStructure:         'grouped',
      items:                 flatItems,
      groups:                apiGroups,
    };
  }

  return {
    codigoCompra,
    cnpj:                  tender.orgaoEntidade.cnpj,
    orgao:                 tender.unidadeOrgao.nomeUnidade,
    informacaoComplementar: tender.informacaoComplementar,
    valorTotalEstimado:    tender.valorTotalEstimado,
    itemStructure:         'flat',
    items:                 rawItems.filter(i => i.tipo === 'I').map(i => normalizeItem(i)),
  };
}

function normalizeItem(i: RawItem, grupo?: string): ApiItem {
  return {
    numero:               i.numero,
    descricao:            i.descricao,
    quantidade:           i.quantidadeSolicitada ?? 0,
    valorUnitarioEstimado: i.valorEstimadoUnitario ?? 0,
    valorTotal:           i.valorEstimadoTotal    ?? 0,
    ...(grupo ? { grupo } : {}),
  };
}
