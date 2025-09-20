export interface NpcDomain {
  id: string;
  imagem: string;
  nome: string;
  classificacao: 'Inimigo' | 'Bestial';
  tipo: 'Comum' | 'Elite' | 'Mágico' | 'Lendário';
  descricao: string;
  alinhamento: string;
  pontos_de_vida: number;
  classe_armadura: number;
  forca: number;
  constituicao: number;
  destreza: number;
  sabedoria: number;
  inteligencia: number;
  energia: number;
  ataques: string;
  xp: number;
  visivel_jogadores: boolean;
  email?: string; // quem cadastrou;
}
