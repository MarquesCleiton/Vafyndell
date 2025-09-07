export interface CatalogoDomain {
  index: number;          // índice incremental na planilha
  id: number;             // id único (pode ser igual ao index)
  nome: string;           // nome do item
  unidade_medida: string; // g, kg, ml, l, cm, m, unidade...
  peso: number;           // peso em unidade escolhida
  categoria: string;      // categoria do item
  origem: string;         // Fabricável | Natural
  raridade: string;       // Comum | Incomum | Raro | Épico | Lendário
  efeito: string;         // efeito principal
  colateral: string;      // efeito colateral
  descricao: string;      // descrição livre
  imagem?: string;        // URL ou base64 da imagem
  email?: string;         // usuário que cadastrou
}
