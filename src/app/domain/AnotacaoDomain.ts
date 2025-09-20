export interface AnotacaoDomain {
  id: string;       // 🔑 agora ULID
  jogador: string;  // email do jogador dono da anotação
  autor: string;    // email do autor da anotação
  titulo: string;
  descricao: string;
  imagem?: string;
  data: string;     // ISO string
  tags?: string;
}
