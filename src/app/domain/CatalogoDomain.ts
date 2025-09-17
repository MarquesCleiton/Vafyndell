import { ReceitaDomain } from "./ReceitaDomain";

export interface CatalogoDomain {
  index: number;                // índice incremental na planilha
  id: string;                   
  nome: string;                 // nome do item
  quantidade_fabricavel: number; // 🔑 novo campo
  unidade_medida: string;       // g, kg, ml, l, cm, m, unidade...
  peso: number;                 // peso em unidade escolhida
  categoria: string;            // categoria do item
  origem: string;               // Fabricável | Natural
  raridade: string;             // Comum | Incomum | Raro | Épico | Lendário
  efeito: string;               // efeito principal
  colateral: string;            // efeito colateral
  descricao: string;            // descrição livre
  imagem?: string;              // URL ou base64 da imagem
  visivel_jogadores: boolean;
  email?: string;               // usuário que cadastrou

  // 🔗 Associações (OO)
  ingredientes?: IngredienteDomain[]; // lista de ingredientes para fabricá-lo
  receitas?: ReceitaDomain[];        // lista de receitas onde este item é usado como ingrediente
}

export interface IngredienteDomain {
  catalogo: CatalogoDomain;  // item do catálogo usado como ingrediente
  quantidade: number;        // quantidade exigida
}

