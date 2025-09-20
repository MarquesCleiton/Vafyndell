export interface RamoDomain {
  id: string;
  arvore: string; // FK → ArvoreDomain.id
  ramo: string;
}
