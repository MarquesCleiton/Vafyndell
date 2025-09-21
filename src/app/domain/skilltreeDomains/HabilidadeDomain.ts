export interface HabilidadeDomain {
  id: string;
  caminho: string;
  arvore: string;
  habilidade: string;
  nivel: number;
  dependencia: string | null;  // 👈 sempre presente
  requisitos?: string;
  descricao?: string;
}
