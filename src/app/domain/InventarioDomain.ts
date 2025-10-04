export interface InventarioDomain {
  id: string;
  jogador: string;
  item_catalogo: string;
  quantidade: number;
  index: number; // ← opcional, vem do Sheet
  descricao?: string; // 🆕 motivo da inclusão (compra, achado, etc.)
}
