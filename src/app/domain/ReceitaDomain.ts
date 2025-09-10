export interface ReceitaDomain {
  index: number;       // índice incremental na planilha
  id: number;          // id único (pode ser igual ao index)
  fabricavel: number;  // id do item do catálogo que será criado
  catalogo: number;    // id do item do catálogo usado como ingrediente
  quantidade: number;  // quantidade necessária do ingrediente
  email?: string;      // usuário que cadastrou (opcional)
}
