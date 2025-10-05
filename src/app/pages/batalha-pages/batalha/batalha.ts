import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JogadorDomain, JogadorUtils } from '../../../domain/jogadorDomain';
import { RegistroDomain } from '../../../domain/RegistroDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';

interface SecaoRegistro {
  data: string;
  itens: RegistroComMeta[];
  expandido: boolean;
}

interface RegistroComMeta extends RegistroDomain {
  icone?: string;
  cor?: string;
}

@Component({
  selector: 'app-batalha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batalha.html',
  styleUrls: ['./batalha.css'],
})
export class Batalha implements OnInit {
  abaAtiva: 'campo' | 'historico' = 'campo';

  // Campo de batalha
  jogadores: JogadorDomain[] = [];
  jogadoresFiltrados: JogadorDomain[] = [];
  carregando = true;
  filtro = '';

  processando: Record<string, 'abrir' | 'excluir' | 'espada' | 'recuperar' | null> = {};
  JogadorUtils = JogadorUtils;

  // Histórico
  secoesHistorico: SecaoRegistro[] = [];
  secoesHistoricoFiltradas: SecaoRegistro[] = [];
  carregandoHistorico = true;
  filtroHistorico = '';

  private repoJogadores = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private repoRegistros = new BaseRepositoryV2<RegistroDomain>('Registro');

  secoesExpandidas = {
    jogadores: true,
    bestiais: true,
  };


  constructor(private router: Router) { }

  async ngOnInit() {
    await Promise.all([this.carregarJogadores(), this.carregarHistorico()]);
  }

  // ==========================================================
  // ⚔️ CAMPO DE BATALHA
  // ==========================================================
  async carregarJogadores() {
    try {
      const locais = await this.repoJogadores.getLocal();
      this.jogadores = locais;
      this.aplicarFiltro();
      this.carregando = false;

      (async () => {
        const updated = await this.repoJogadores.sync();
        if (updated) {
          const atualizados = await this.repoJogadores.getLocal();
          this.jogadores = atualizados;
          this.aplicarFiltro();
        }
      })();
    } catch (err) {
      console.error('[Batalha] Erro ao carregar jogadores:', err);
      this.carregando = false;
    }
  }

  aplicarFiltro() {
    const termo = this.normalizarTexto(this.filtro);
    this.jogadoresFiltrados = !termo
      ? [...this.jogadores]
      : this.jogadores.filter(j =>
        this.normalizarTexto(j.personagem).includes(termo) ||
        this.normalizarTexto(j.nome_do_jogador).includes(termo) ||
        this.normalizarTexto(j.classificacao).includes(termo) ||
        this.normalizarTexto(j.tipo).includes(termo)
      );
  }

  get jogadoresNormais(): JogadorDomain[] {
    return this.jogadoresFiltrados.filter(j => j.nome_do_jogador !== 'NPC');
  }

  get bestiais(): JogadorDomain[] {
    return this.jogadoresFiltrados.filter(j => j.nome_do_jogador === 'NPC');
  }

  async abrirDetalhes(jogador: JogadorDomain) {
    this.processando[jogador.id] = 'abrir';
    setTimeout(() => {
      this.router.navigate(['/visao-jogadores', jogador.id]);
      this.processando[jogador.id] = null;
    }, 400);
  }

  async acaoEspada(jogador: JogadorDomain) {
    this.processando[jogador.id] = 'espada';
    setTimeout(() => {
      this.router.navigate(['/combate', jogador.id]);
      this.processando[jogador.id] = null;
    }, 400);
  }

  async acaoRecuperacao(jogador: JogadorDomain) {
    this.processando[jogador.id] = 'recuperar';
    setTimeout(() => {
      this.router.navigate(['/recuperacao', jogador.id]);
      this.processando[jogador.id] = null;
    }, 400);
  }

  async excluirNpcDaBatalha(j: JogadorDomain) {
    const confirmacao = confirm(`🗑️ Deseja remover "${j.personagem}" do campo de batalha?`);
    if (!confirmacao) return;

    this.processando[j.id] = 'excluir';
    try {
      await this.repoJogadores.delete(j.id);
      this.jogadores = this.jogadores.filter(x => x.id !== j.id);
      this.aplicarFiltro();
      alert('✅ NPC removido da batalha!');
    } catch (err) {
      console.error('[Batalha] Erro ao excluir NPC:', err);
      alert('❌ Erro ao excluir NPC da batalha.');
    } finally {
      this.processando[j.id] = null;
    }
  }

  // ==========================================================
  // 📜 HISTÓRICO
  // ==========================================================
  async carregarHistorico() {
    this.carregandoHistorico = true;
    try {
      const locais = await this.repoRegistros.getLocal();
      const filtrados = locais.filter(r => r.tipo === 'batalha' || r.tipo === 'recuperacao');
      this.processarSecoesHistorico(filtrados);

      this.repoRegistros.sync().then(async updated => {
        if (updated) {
          const atualizados = await this.repoRegistros.getLocal();
          const filtradosAtualizados = atualizados.filter(
            r => r.tipo === 'batalha' || r.tipo === 'recuperacao'
          );
          this.processarSecoesHistorico(filtradosAtualizados);
        }
      });
    } catch (err) {
      console.error('[Batalha] Erro ao carregar histórico:', err);
    } finally {
      this.carregandoHistorico = false;
    }
  }

  processarSecoesHistorico(lista: RegistroDomain[]) {
    const estados = new Map(this.secoesHistorico.map(s => [s.data, s.expandido]));
    const mapa = new Map<string, RegistroComMeta[]>();

    lista.forEach(r => {
      const rawData = r.data || '';
      const soData = rawData.includes('T') ? rawData.split('T')[0] : rawData;
      const meta: RegistroComMeta = {
        ...r,
        icone: this.getIconeTipo(r.tipo),
        cor: this.getCorTipo(r.tipo),
      };

      if (!mapa.has(soData)) mapa.set(soData, []);
      mapa.get(soData)!.push(meta);
    });

    this.secoesHistorico = Array.from(mapa.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([data, itens]) => ({
        data,
        itens: itens.sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()),
        expandido: estados.get(data) ?? true,
      }));

    this.aplicarFiltroHistorico();
  }

  aplicarFiltroHistorico() {
    const termo = this.normalizarTexto(this.filtroHistorico);

    this.secoesHistoricoFiltradas = this.secoesHistorico
      .map(secao => ({
        ...secao,
        itens: secao.itens.filter(r => !termo || this.normalizarTexto(r.detalhes).includes(termo)),
      }))
      .filter(s => s.itens.length > 0);
  }

  selecionarAba(aba: 'campo' | 'historico') {
    this.abaAtiva = aba;
  }

  toggleSecao(secao: SecaoRegistro) {
    secao.expandido = !secao.expandido;
  }

  private normalizarTexto(txt: string): string {
    return txt ? txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
  }

  private getIconeTipo(tipo: string = ''): string {
    const mapa: Record<string, string> = { batalha: '⚔️', recuperacao: '💊' };
    return mapa[tipo] || '📜';
  }

  private getCorTipo(tipo: string = ''): string {
    const mapa: Record<string, string> = { batalha: '#f87171', recuperacao: '#4ade80' };
    return mapa[tipo] || '#9ca3af';
  }

  formatarData(data: string): string {
    try {
      const d = data.includes('T') ? new Date(data) : new Date(data + 'T00:00:00');
      return d.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  }

toggleSecaoCampo(tipo: 'jogadores' | 'bestiais') {
  this.secoesExpandidas[tipo] = !this.secoesExpandidas[tipo];
}


}
