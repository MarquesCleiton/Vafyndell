import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JogadorDomain, JogadorUtils } from '../../../domain/jogadorDomain';
import { RegistroDomain } from '../../../domain/RegistroDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';

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
export class Batalha implements OnInit, OnDestroy {
  abaAtiva: 'campo' | 'historico' = 'campo';
  private syncSub: Subscription | null = null;

  // Lançador de dados
  modalDadosAberto = false;
  dadosContagem: Record<string, number> = {
    d2: 0,
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    d20: 0,
    d100: 0
  };
  resultadoRolagem: {
    soma: number;
    detalhes: { dado: string; rolls: number[]; soma: number; criticoLabel?: string }[];
    estado: 'normal' | 'critico' | 'falha';
  } | null = null;
  rolando = false;

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

  constructor(private router: Router) {}

  async ngOnInit() {
    await Promise.all([this.carregarJogadores(), this.carregarHistorico()]);
    
    // Inscrição reativa global
    this.syncSub = BaseRepositoryV2.onTabUpdated.subscribe(async (tab) => {
      console.log(`[Batalha] 🔔 Evento de atualização recebido para a aba: ${tab}`);
      if (tab === 'Personagem') {
        const atualizados = await this.repoJogadores.getLocal();
        this.jogadores = atualizados;
        this.aplicarFiltro();
        console.log('[Batalha] ✅ Jogadores atualizados reativamente');
      } else if (tab === 'Registro') {
        const atualizados = await this.repoRegistros.getLocal();
        const filtrados = atualizados.filter(r => r.tipo === 'batalha' || r.tipo === 'recuperacao');
        this.processarSecoesHistorico(filtrados);
        console.log('[Batalha] ✅ Histórico atualizado reativamente');
      }
    });
  }

  ngOnDestroy() {
    if (this.syncSub) {
      this.syncSub.unsubscribe();
      this.syncSub = null;
    }
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

      // Dispara a sincronia rápida inicial em segundo plano.
      this.repoJogadores.sync();
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
    // BUG-10 melhoria de UX: deixar claro que a removção é permanente nesta sessão
    // (NPC é uma cópia em Personagem criada ao entrar na batalha — a ficha original em NPCs não é afetada)
    const confirmacao = confirm(
      `🗑️ Remover "${j.personagem}" do campo de batalha?\n\n` +
      `⚠️ Esta ação remove o NPC permanentemente da batalha atual.\n` +
      `A ficha original em "Feras & Vilões" não será afetada.`
    );
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

      // Dispara a sincronia em segundo plano
      this.repoRegistros.sync();
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

  // ── Apresentação ────────────────────────────────────────
  /** Retorna o percentual de HP para a barra visual (0–100) */
  calcHpPercent(j: JogadorDomain): number {
    const base = JogadorUtils.getVidaBase(j);
    if (!base || base <= 0) return 0;
    const atual = JogadorUtils.getVidaAtual(j);
    return Math.max(0, Math.min(100, (atual / base) * 100));
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

  // ==========================================================
  // 🎲 LANÇADOR DE DADOS
  // ==========================================================
  abrirModalDados() {
    this.modalDadosAberto = true;
    this.limparDados();
  }

  fecharModalDados() {
    this.modalDadosAberto = false;
    this.resultadoRolagem = null;
  }

  adicionarDado(tipo: string) {
    if (this.resultadoRolagem) {
      this.resultadoRolagem = null;
    }
    const key = tipo.toLowerCase();
    if (this.dadosContagem[key] !== undefined) {
      this.dadosContagem[key]++;
    }
  }

  removerDado(tipo: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.resultadoRolagem) {
      this.resultadoRolagem = null;
    }
    const key = tipo.toLowerCase();
    if (this.dadosContagem[key] !== undefined && this.dadosContagem[key] > 0) {
      this.dadosContagem[key]--;
    }
  }

  limparDados() {
    for (const key of Object.keys(this.dadosContagem)) {
      this.dadosContagem[key] = 0;
    }
    this.resultadoRolagem = null;
  }

  get resumoEscolhas(): string[] {
    const ordem = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
    const resumo: string[] = [];
    for (const key of ordem) {
      const qtd = this.dadosContagem[key];
      if (qtd > 0) {
        resumo.push(`${qtd}${key.toUpperCase()}`);
      }
    }
    return resumo;
  }

  async rolarDados() {
    const ordem = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
    const dadosSelecionados = ordem
      .map(tipo => ({ tipo, qtd: this.dadosContagem[tipo] }))
      .filter(item => item.qtd > 0);

    if (dadosSelecionados.length === 0) {
      alert('⚠️ Selecione pelo menos um dado para rolar.');
      return;
    }

    this.rolando = true;
    try {
      let somaTotal = 0;
      const detalhes: { dado: string; rolls: number[]; soma: number; criticoLabel?: string }[] = [];
      const lines: string[] = [];
      let temCriticoD20 = false;
      let temFalhaD20 = false;

      for (const { tipo, qtd } of dadosSelecionados) {
        const faces = parseInt(tipo.replace('d', ''), 10);
        const rolls: number[] = [];
        let somatorioDado = 0;

        for (let i = 0; i < qtd; i++) {
          const roll = Math.floor(Math.random() * faces) + 1;
          rolls.push(roll);
          somatorioDado += roll;

          if (tipo === 'd20') {
            if (roll === 20) temCriticoD20 = true;
            if (roll === 1) temFalhaD20 = true;
          }
        }

        somaTotal += somatorioDado;

        let labelCritico = '';
        if (tipo === 'd20') {
          if (rolls.includes(20)) {
            labelCritico = ' 🔥 ACERTO CRÍTICO!';
          } else if (rolls.includes(1)) {
            labelCritico = ' 💀 FALHA CRÍTICA!';
          }
        }

        detalhes.push({
          dado: tipo.toUpperCase(),
          rolls,
          soma: somatorioDado,
          criticoLabel: labelCritico.trim()
        });

        if (qtd > 1) {
          lines.push(`${qtd}${tipo.toUpperCase()} ➔ ${rolls.join(' + ')} = ${somatorioDado}${labelCritico}`);
        } else {
          lines.push(`${qtd}${tipo.toUpperCase()} ➔ ${somatorioDado} = ${somatorioDado}${labelCritico}`);
        }
      }

      this.resultadoRolagem = {
        soma: somaTotal,
        detalhes,
        estado: temCriticoD20 ? 'critico' : (temFalhaD20 ? 'falha' : 'normal')
      };

      const user = AuthService.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado.');
      }

      const jogadorLogado = this.jogadores.find(j => j.email === user.email);
      const nomePersonagem = jogadorLogado ? jogadorLogado.personagem : (user.name || 'Jogador');

      let sufixoCritico = '';
      if (temCriticoD20) {
        sufixoCritico = ' 🔥 ACERTO CRÍTICO!';
      } else if (temFalhaD20) {
        sufixoCritico = ' 💀 FALHA CRÍTICA!';
      }

      const registroDetalhes = `🎲 ${nomePersonagem} rolou os dados e obteve ${somaTotal}!${sufixoCritico}\n\n` + lines.join('\n');

      const novoRegistro: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: user.email,
        tipo: 'batalha',
        acao: 'rolagem',
        detalhes: registroDetalhes,
        data: new Date().toISOString()
      };

      await BaseRepositoryV2.batch({
        create: { Registro: [novoRegistro] }
      });

      console.log('[Batalha] 🎲 Rolagem registrada com sucesso no Registro');
      await this.carregarHistorico();

    } catch (err) {
      console.error('[Batalha] Erro ao registrar rolagem:', err);
      alert('❌ Erro ao salvar resultado da rolagem.');
    } finally {
      this.rolando = false;
    }
  }
}
