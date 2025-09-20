export interface ReceitaDomain {
  id: string;          // id único (pode ser igual ao index)
  fabricavel: string;  // id do item do catálogo que será criado
  catalogo: string;    // id do item do catálogo usado como ingrediente
  quantidade: number;  // quantidade necessária do ingrediente
  email?: string;      // usuário que cadastrou (opcional)
}
