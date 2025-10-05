import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegistroDomain } from '../../domain/RegistroDomain';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../repositories/BaseRepositoryV2';
import { AuthService } from '../../core/auth/AuthService';

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
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css'],
})
export class Registro implements OnInit {
  secoes: SecaoRegistro[] = [];
  secoesFiltradas: SecaoRegistro[] = [];
  carregando = true;
  filtro = '';
  filtroVisao = 'todos';

  meuPersonagem: JogadorDomain | null = null;
  outrosJogadores: JogadorDomain[] = [];

  private repo = new BaseRepositoryV2<RegistroDomain>('Registro');
  private jogadoresRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();
    } catch (err) {
      console.error('[Registro] Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  private async loadLocalAndSync() {
    const user = AuthService.getUser();
    const jogadores = await this.jogadoresRepo.getLocal();

    this.meuPersonagem = jogadores.find(j => j.email === user?.email) || null;
    this.outrosJogadores = (await this.jogadoresRepo.getLocal())
      // 👇 remove NPCs do filtro
      .filter(j => j.nome_do_jogador?.trim().toLowerCase() !== 'npc');
    const locais = await this.repo.getLocal();
    await this.resolveJogadores(locais, jogadores);
    this.processarSecoes(locais);

    this.repo.sync().then(async updated => {
      if (updated) {
        const atualizados = await this.repo.getLocal();
        await this.resolveJogadores(atualizados, jogadores);
        this.processarSecoes(atualizados);
      }
    });

    if (locais.length === 0) {
      const online = await this.repo.forceFetch();
      await this.resolveJogadores(online, jogadores);
      this.processarSecoes(online);
    }
  }

  private async resolveJogadores(registros: RegistroDomain[], jogadores: JogadorDomain[]) {
    registros.forEach(r => {
      r.ofensor = jogadores.find(j => j.email === r.jogador) || null;
      r.vitima = jogadores.find(j => j.email === r.alvo) || null;
    });
  }

  private processarSecoes(lista: RegistroDomain[]) {
    const estados = new Map(this.secoes.map(s => [s.data, s.expandido]));
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

    this.secoes = Array.from(mapa.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([data, itens]) => ({
        data,
        itens: itens.sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()),
        expandido: estados.get(data) ?? true,
      }));

    this.aplicarFiltro();
  }

  aplicarFiltro() {
    // 🔍 Normaliza o termo de busca (sem acentos, case-insensitive)
    const termo = this.normalizarTexto(this.filtro);
    const visao = this.filtroVisao;
    const user = AuthService.getUser();

    this.secoesFiltradas = this.secoes
      .map(secao => ({
        ...secao,
        itens: secao.itens.filter(r => {
          // 📦 Normaliza todos os campos relevantes antes da comparação
          const condTexto =
            !termo ||
            this.normalizarTexto(r.detalhes).includes(termo) ||
            this.normalizarTexto(r.tipo).includes(termo) ||
            this.normalizarTexto(r.acao).includes(termo) ||
            this.normalizarTexto(r.ofensor?.personagem || '').includes(termo) ||
            this.normalizarTexto(r.vitima?.personagem|| '').includes(termo) ||
            this.normalizarTexto(r.ofensor?.nome_do_jogador|| '').includes(termo) ||
            this.normalizarTexto(r.vitima?.nome_do_jogador|| '').includes(termo);

          // 🧭 Aplica o filtro de visão (quem pode ver o quê)
          if (visao === 'todos') return condTexto;

          if (visao === 'meu' && user?.email)
            return (
              condTexto &&
              (r.jogador === user.email || r.alvo === user.email)
            );

          // 🎯 Quando o filtro é um jogador específico (email)
          if (visao !== 'todos' && visao !== 'meu')
            return condTexto && (r.jogador === visao || r.alvo === visao);

          return false;
        }),
      }))
      .filter(s => s.itens.length > 0);
  }



  /** 🧙 Define emoji do jogador */
  getEmoji(j: JogadorDomain): string {
    const map: Record<string, string> = {
      mestre: '🧑‍🏫',
      npc: '🐍',
      bestial: '🐉',
      jogador: '🧝‍♂️',
    };

    const tipo = (j.classificacao || j.tipo_jogador || '').toLowerCase();

    if (tipo.includes('mestre')) return map['mestre'];
    if (tipo.includes('npc') || tipo.includes('inimigo') || tipo.includes('bestial')) return map['npc'];
    if (tipo.includes('bestial')) return map['bestial'];
    return map['jogador'];
  }

  toggleSecao(secao: SecaoRegistro) {
    secao.expandido = !secao.expandido;
  }

  private normalizarTexto(txt: string): string {
    return txt
      ? txt
        .normalize('NFD') // remove acentos e cedilhas
        .replace(/[\u0300-\u036f]/g, '') // tira marcas diacríticas
        .toLowerCase() // deixa tudo minúsculo
        .trim() // remove espaços extras
      : '';
  }

  formatarData(data: string): string {
    try {
      const d = data.includes('T') ? new Date(data) : new Date(data + 'T00:00:00');
      return d.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  }

  private getIconeTipo(tipo: string = ''): string {
    const mapa: Record<string, string> = {
      batalha: '⚔️',
      recuperacao: '💊',
      inventario: '🎒',
      transferencia: '📦',
      fabricacao: '⚒️',
    };
    return mapa[tipo] || '🪶';
  }

  private getCorTipo(tipo: string = ''): string {
    const mapa: Record<string, string> = {
      batalha: '#f87171',
      recuperacao: '#4ade80',
      inventario: '#60a5fa',
      transferencia: '#fbbf24',
      fabricacao: '#a78bfa',
    };
    return mapa[tipo] || '#9ca3af';
  }
}
