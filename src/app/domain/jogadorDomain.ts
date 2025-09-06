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
}
