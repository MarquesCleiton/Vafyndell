export interface NpcDomain {
  id: string;
  imagem: string;
  nome: string;
  classificacao: 'Inimigo' | 'Bestial';
  tipo: 'Comum' | 'Elite' | 'Mágico' | 'Lendário';
  descricao: string;
  alinhamento: string;
  ataques: string;
  visivel_jogadores: boolean;
  email?: string; // quem cadastrou

  // ── Combate ──────────────────────────────
  pontos_de_vida: number;
  classe_armadura: number;
  escudo?: number;
  xp: number;

  // ── Atributos primários ───────────────────
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria: number;
  carisma?: number;
  energia: number;

  // ── Secundários (agora iguais ao jogador) ──
  nivel?: number;
  pontos_de_sorte?: number;
  fator_de_cura?: number;
  deslocamento?: number;
}
