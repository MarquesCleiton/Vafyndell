export interface ArvoreDomain {
  id: string;
  caminho: string; // FK → CaminhoDomain.id
  arvore: string;
}
