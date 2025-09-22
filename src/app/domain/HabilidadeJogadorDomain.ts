import { HabilidadeDomain } from "./skilltreeDomains/HabilidadeDomain";

export interface HabilidadeJogadorDomain {
  id: string;               // 🔑 PK única
  jogador: string;          // email do jogador
  habilidade: string;       // FK → HabilidadeDomain.id
  data_aquisicao: string;   // ISO date da aquisição

  // 🔗 Associações (OO)
  habilidadeRef?: HabilidadeDomain; // referência direta à habilidade adquirida
}
