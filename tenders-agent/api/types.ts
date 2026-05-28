export interface ApiItem {
  numero:               number;
  descricao:            string;
  quantidade:           number;
  valorUnitarioEstimado: number;
  valorTotal:           number;
  grupo?:               string;  // "G1", "G2" — only when grouped
}

export interface ApiGroup {
  identificador:    string;  // "G1", "G2"
  descricao:        string;
  valorEstimadoTotal: number;
  items:            ApiItem[];
}

export interface ApiTenderData {
  codigoCompra:          string;
  cnpj:                  string;
  orgao:                 string;
  informacaoComplementar: string | null;
  valorTotalEstimado:    number;
  itemStructure:         'flat' | 'grouped';
  items:                 ApiItem[];   // flat — always populated (groups are flattened with grupo field)
  groups?:               ApiGroup[]; // only when grouped, for business rule enforcement
}
