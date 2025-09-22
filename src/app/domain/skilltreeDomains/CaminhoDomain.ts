export interface CaminhoDomain {
  id: string;
  caminho: string;
  imagem?: string;
  expandido?: boolean; // 👈 usado só no front para abrir/fechar
}
