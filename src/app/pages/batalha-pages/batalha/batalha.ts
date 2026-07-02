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
import { ScriptClientV4 } from '../../../core/script/ScriptClientV4';

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
  rolandoAnimacao = false;

  // Animações de resultado
  numerosRolando = false;
  numeroAtual = 0;
  modalShake = false;
  mostrarOverlayCritico = false;
  mostrarOverlayFalha = false;
  particlesCritico: { tx: number; ty: number; clr: string; dur: number; delay: number; size: number }[] = [];
  shardsFalha: { x: number; w: number; h: number; rot: number; dur: number; delay: number }[] = [];

  // Banner de crítico de outros jogadores
  bannerCritico: string | null = null;
  private registrosVistos = new Set<string>();

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
        this.detectarCriticosDeOutrosJogadores(filtrados);
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

      // Marca todos os registros existentes como "já vistos" para evitar animações retroativas
      filtrados.forEach(r => this.registrosVistos.add(r.id));

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
      // Zera todos os outros dados ao selecionar um novo
      for (const k of Object.keys(this.dadosContagem)) {
        if (k !== key) {
          this.dadosContagem[k] = 0;
        }
      }
      
      // Limite de até 10x
      if (this.dadosContagem[key] < 10) {
        this.dadosContagem[key]++;
      }
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

      // Prepara objeto, mas não define no UI ainda (movido para o setTimeout)

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

      // 1. Calcular tempos e decidir se precisamos empurrar para o próximo pooling
      const now = Date.now();
      const INTERVALO_SYNC_MS = 10000;
      let timeToNextSync = INTERVALO_SYNC_MS - (now % INTERVALO_SYNC_MS);
      
      let targetRevealTime = now + timeToNextSync;
      let delayUploadMs = 0;

      // Se faltar muito pouco tempo para o pooling (menos de 2.5s), empurra a revelação
      // em 10s e atrasa o envio para o servidor para garantir que o ciclo de sincronização atual
      // dos outros jogadores não puxe o registro antes de iniciarmos a nova rodada.
      if (timeToNextSync < 2500) {
        targetRevealTime += INTERVALO_SYNC_MS;
        // Atrasamos o envio para 1s após o início do pooling atual
        delayUploadMs = timeToNextSync + 1000;
      }

      const waitTime = targetRevealTime - Date.now();
      console.log(`[Batalha] 🎲 Dado rolado. Tempo de animação: ${waitTime}ms. Atraso no envio: ${delayUploadMs}ms.`);

      // 2. Envia para o servidor silenciosamente (sem acionar o banco local agora para evitar spoiler)
      setTimeout(async () => {
        try {
          console.log('[Batalha] 📤 Enviando rolagem para o servidor silenciosamente...');
          await ScriptClientV4.create({ Registro: [novoRegistro] });
          console.log('[Batalha] 📤 Rolagem enviada ao servidor com sucesso.');
        } catch (err) {
          console.error('[Batalha] Erro ao enviar rolagem para o servidor:', err);
        }
      }, delayUploadMs);

      // 3. Ativar animação de loading e esperar
      this.rolandoAnimacao = true;

      setTimeout(async () => {
        this.rolandoAnimacao = false;
        
        // Revelar resultado
        this.resultadoRolagem = {
          soma: somaTotal,
          detalhes,
          estado: temCriticoD20 ? 'critico' : (temFalhaD20 ? 'falha' : 'normal')
        };

        // Animação slot machine no número
        this.triggerSlotMachine(somaTotal, 800);

        // Disparar overlays épicos após o slot machine
        if (temCriticoD20) {
          setTimeout(() => this.triggerCriticoOverlay(nomePersonagem), 300);
        } else if (temFalhaD20) {
          setTimeout(() => this.triggerFalhaOverlay(nomePersonagem), 200);
        }
        
        // Puxar histórico local (que já deve ter recebido pelo pooling global)
        await this.carregarHistorico();
        this.rolando = false; // liberação final
      }, waitTime);

    } catch (err) {
      console.error('[Batalha] Erro ao registrar rolagem:', err);
      alert('❌ Erro ao salvar resultado da rolagem.');
      this.rolando = false;
    }
  }

  // ==========================================================
  // 🎰 ANIMAÇÕES DE DADOS
  // ==========================================================

  /** Animação de slot machine: exibe números aleatórios rapidamente, depois revela o valor final. */
  private triggerSlotMachine(valorFinal: number, duracaoMs: number) {
    this.numerosRolando = true;
    this.numeroAtual = Math.floor(Math.random() * valorFinal) + 1;

    const intervalo = 60; // ms entre cada troca
    const passos = Math.floor(duracaoMs / intervalo);
    let passo = 0;

    const timer = setInterval(() => {
      passo++;
      // Desacelera no final: nos últimos 30% dos passos, atualiza a cada 2 passos
      const naFinalReta = passo > passos * 0.7;
      if (!naFinalReta || passo % 2 === 0) {
        this.numeroAtual = Math.floor(Math.random() * (valorFinal + 10)) + 1;
      }

      if (passo >= passos) {
        clearInterval(timer);
        this.numerosRolando = false;
        // Garante que o valor exibido é o correto
        this.numeroAtual = valorFinal;
      }
    }, intervalo);
  }

  /** Overlay de Acerto Crítico: flash dourado + partículas + stamp épico. */
  private triggerCriticoOverlay(nomePersonagem?: string) {
    const cores = ['#ffd700', '#ffc107', '#ff9f43', '#fff176', '#ffca28', '#ffffff'];
    this.particlesCritico = Array.from({ length: 28 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 80 + Math.random() * 220;
      return {
        tx:    Math.cos(angle) * dist,
        ty:    Math.sin(angle) * dist,
        clr:   cores[Math.floor(Math.random() * cores.length)],
        dur:   0.6 + Math.random() * 0.7,
        delay: Math.random() * 0.25,
        size:  4 + Math.random() * 10,
      };
    });

    if (nomePersonagem) {
      this.bannerCritico = `🌟 ${nomePersonagem} acertou um CRÍTICO!`;
    }
    
    // Tocar som de sucesso
    this.tocarSom('/sounds/Successful.mp3');

    this.mostrarOverlayCritico = true;
    setTimeout(() => { this.mostrarOverlayCritico = false; this.bannerCritico = null; }, 2400);
  }

  /** Overlay de Falha Crítica: vignette vermelha + shards caindo + tremor no modal. */
  private triggerFalhaOverlay(nomePersonagem?: string) {
    this.shardsFalha = Array.from({ length: 20 }, () => ({
      x:     Math.random() * 100,
      w:     4 + Math.random() * 10,
      h:     12 + Math.random() * 24,
      rot:   -30 + Math.random() * 60,
      dur:   0.9 + Math.random() * 0.8,
      delay: Math.random() * 0.4,
    }));

    if (nomePersonagem) {
      this.bannerCritico = `💀 ${nomePersonagem} teve uma FALHA CRÍTICA!`;
    }

    // Tocar som de falha
    this.tocarSom('/sounds/Fail.mp3');

    this.mostrarOverlayFalha = true;
    this.modalShake = true;
    setTimeout(() => { this.modalShake = false; }, 550);
    setTimeout(() => { this.mostrarOverlayFalha = false; this.bannerCritico = null; }, 2500);
  }

  /**
   * Toca um arquivo de som de forma segura
   */
  private tocarSom(caminho: string) {
    try {
      const som = new Audio(caminho);
      som.play().catch(err => {
        console.warn(`[Batalha] Não foi possível reproduzir o som ${caminho}:`, err);
      });
    } catch (err) {
      console.error(`[Batalha] Erro ao reproduzir o som ${caminho}:`, err);
    }
  }

  /**
   * Detecta novos registros de ACERTO CRÍTICO ou FALHA CRÍTICA de outros jogadores
   * e dispara os overlays épicos para todos os jogadores na tela.
   */
  private detectarCriticosDeOutrosJogadores(registros: RegistroDomain[]) {
    const user = AuthService.getUser();
    const emailProprio = user?.email ?? null;

    const novosComCritico = registros.filter(r => {
      // Apenas registros ainda não vistos
      if (this.registrosVistos.has(r.id)) return false;
      // Apenas rolaens com crítico/falha
      return r.acao === 'rolagem' && r.detalhes &&
        (r.detalhes.includes('ACERTO CRÍTICO') || r.detalhes.includes('FALHA CRÍTICA'));
    });

    // Marca todos os atuais como vistos
    registros.forEach(r => this.registrosVistos.add(r.id));

    for (const reg of novosComCritico) {
      // Ignora o próprio jogador (ele já vê a animação no modal)
      if (emailProprio && reg.jogador === emailProprio) continue;

      // Extrai nome do personagem do texto do registro
      const match = reg.detalhes?.match(/🎲\s(.+?)\srolou/);
      const nomePersonagem = match ? match[1] : 'Alguém';

      const ehCritico = reg.detalhes!.includes('ACERTO CRÍTICO');
      console.log(`[Batalha] 🔔 Crítico detectado de ${nomePersonagem}: ${ehCritico ? 'ACERTO' : 'FALHA'}`);

      if (ehCritico) {
        setTimeout(() => this.triggerCriticoOverlay(nomePersonagem), 200);
      } else {
        setTimeout(() => this.triggerFalhaOverlay(nomePersonagem), 200);
      }
      break; // Dispara apenas o primeiro crítico detectado para não sobrepor
    }
  }
}
