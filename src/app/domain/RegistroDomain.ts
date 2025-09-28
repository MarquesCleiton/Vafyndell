import { JogadorDomain } from "./jogadorDomain";

export interface RegistroDomain {
  id: string;
  jogador: string;
  alvo?: string;
  tipo: string;
  acao: string;
  detalhes: string;
  data: string;

  // Resolução em memória
  ofensor?: JogadorDomain | null;
  vitima?: JogadorDomain | null;
}
