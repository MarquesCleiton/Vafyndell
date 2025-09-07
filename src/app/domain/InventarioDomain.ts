export interface InventarioDomain {
  id: number;
  jogador: string;
  item_catalogo: number;
  quantidade: number;
  index?: number; // ← opcional, vem do Sheet
}
