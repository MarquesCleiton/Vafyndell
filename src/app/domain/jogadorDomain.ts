export interface JogadorDomain {
  index: number;
  id: number;
  email: string;
  imagem: string;
  nome_do_jogador: string;
  personagem: string;
  pontos_de_vida: number;
  alinhamento: string;
  classe_de_armadura: number;
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria: number;
  carisma: number;
  energia: number;
  nivel: number;
  xp: number;
  dano_tomado: number;
  tipo_jogador: string;
  efeitos_temporarios: string;
  registo_de_jogo: string;
  classificacao: string;
  tipo: string;
  descricao: string;
  ataques: string;

  // derivados (calculados, não salvos direto)
  fator_cura?: number;
  vida_total?: number;
  deslocamento?: number;
}

// Apenas os atributos numéricos que podem ser ajustados no cadastro
export type AtributosNumericos = Pick<
  JogadorDomain,
  | "forca"
  | "destreza"
  | "constituicao"
  | "inteligencia"
  | "sabedoria"
  | "carisma"
  | "energia"
  | "classe_de_armadura"
>;

export type AtributoChave = keyof AtributosNumericos;

export class JogadorUtils {
  /** Vida fixa (cadastrada ou calculada a partir de energia + constituição) */
  static getVidaBase(j: JogadorDomain): number {
    return j.pontos_de_vida > 0
      ? j.pontos_de_vida
      : j.energia + j.constituicao;
  }

  /** Vida total atual (inclui CA ainda não quebrada) */
  static getVidaTotal(j: JogadorDomain): number {
    const vidaBase = this.getVidaBase(j);
    const ca = j.classe_de_armadura || 0;
    const dano = j.dano_tomado || 0;
    return vidaBase + ca - dano;
  }

  /** Vida atual do jogador SEM a armadura (apenas carne/ossos) */
  static getVidaAtual(j: JogadorDomain): number {
    const vidaBase = this.getVidaBase(j);
    const dano = j.dano_tomado || 0;
    return vidaBase - dano;
  }

  /** Verifica se o jogador está morto */
  static estaMorto(j: JogadorDomain): boolean {
    return this.getVidaTotal(j) <= 0;
  }
}
