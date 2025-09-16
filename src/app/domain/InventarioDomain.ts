export interface InventarioDomain {
  id: string;
  jogador: string;
  item_catalogo: string;
  quantidade: number;
  index: number; // ← opcional, vem do Sheet
}
