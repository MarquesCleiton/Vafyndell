export interface HabilidadeDomain {
  id: string;
  caminho: string; // FK → CaminhoDomain.id
  arvore: string;  // FK → ArvoreDomain.id
  ramo: string;    // FK → RamoDomain.id
  habilidade: string;
  nivel: number;
  dependencia?: string;
  requisitos?: string;
  descricao?: string;
}
