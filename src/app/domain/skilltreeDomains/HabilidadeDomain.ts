export interface HabilidadeDomain {
  id: string;
  caminho: string;
  arvore: string;
  habilidade: string;
  dependencia: string | null;  // 👈 sempre presente
  requisitos?: string;
  descricao?: string;
}
