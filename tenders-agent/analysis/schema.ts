import { z } from 'zod';

export const ContatoSchema = z.object({
  nome:     z.string().nullable().describe('Nome do responsável ou fiscal do contrato'),
  email:    z.string().nullable().describe('E-mail de contato'),
  telefone: z.string().nullable().describe('Telefone de contato'),
  orgao:    z.string().nullable().describe('Nome do órgão comprador'),
  endereco: z.string().nullable().describe('Endereço do órgão'),
});

export const ItemSchema = z.object({
  descricao:             z.string().describe('Descrição completa do item'),
  quantidade:            z.number().describe('Quantidade solicitada'),
  unidade:               z.string().describe('Unidade de medida (ex: un, kg, m²)'),
  especificacoes:        z.string().describe('Texto integral das especificações técnicas conforme consta no documento, sem resumir ou omitir nenhuma informação'),
  valorUnitarioEstimado: z.number().nullable().describe('Valor unitário estimado se explicitamente declarado no documento'),
});

export const ExtractionSchema = z.object({
  contato:          ContatoSchema,
  itens:            z.array(ItemSchema).describe('Todos os itens/produtos/serviços solicitados'),
  validadeProposta: z.string().nullable().describe('Prazo de validade da proposta (ex: "60 dias")'),
  prazoEntrega:     z.string().nullable().describe('Prazo de entrega ou execução (ex: "30 dias após ordem de serviço")'),
  anexos:           z.array(z.string()).describe('Nomes dos documentos referenciados ou anexados'),
  camposFaltantes:  z.array(z.string()).describe('Campos que não foram encontrados nos documentos'),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractionItem = z.infer<typeof ItemSchema>;
export type Contato = z.infer<typeof ContatoSchema>;
