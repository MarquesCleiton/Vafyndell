import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BaseRepository } from '../../../repositories/BaseRepository';
import { NpcDomain } from '../../../domain/NpcDomain';
import { JogadorDomain } from '../../../domain/jogadorDomain';
import { AuthService } from '../../../core/auth/AuthService';
import { VisibilidadeService } from '../../../services/VisibilidadeService';

interface CategoriaNpc {
  nome: string; // tipo (Comum, Elite, Mágico, Lendário)
  itens: NpcDomain[];
  expandido: boolean;
}

@Component({
  selector: 'app-npcs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './npcs.html',
  styleUrls: ['./npcs.css'],
})
export class Npcs implements OnInit {
  categorias: CategoriaNpc[] = [];
  categoriasFiltradas: CategoriaNpc[] = [];
  carregando = true;
  filtro = '';

  abaAtiva: 'bestiais' | 'inimigos' = 'bestiais';

  private repo = new BaseRepository<NpcDomain>('NPCs', 'NPCs');
  private jogadorRepo = new BaseRepository<JogadorDomain>('Personagem', 'Personagem');
  private todosNpcs: NpcDomain[] = []; // 🔹 cache local em memória
  private visibilidadeService = new VisibilidadeService<NpcDomain>(this.repo);
  
  /** 🔄 controla loading de visibilidade por NPC */
  loadingVisibilidade: Record<string, boolean> = {};
  
  ehMestre = false;

  constructor(private router: Router) { }

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.definirSeEhMestre();
      await this.loadLocalAndSync();
    } catch (err) {
      console.error('[Npcs] Erro ao carregar NPCs:', err);
    } finally {
      this.carregando = false;
    }
  }

  /** Define se o usuário atual é Mestre */
  private async definirSeEhMestre() {
    const user = AuthService.getUser();
    if (user?.email) {
      const jogadores = await this.jogadorRepo.getLocal();
      const jogadorAtual = jogadores.find((j) => j.email === user.email);
      this.ehMestre = jogadorAtual?.tipo_jogador === 'Mestre';
    }
  }

  private async loadLocalAndSync() {
    const locais = await this.repo.getLocal();
    this.todosNpcs = locais;
    this.processarCategorias(this.todosNpcs);

    this.repo.sync().then(async (updated) => {
      if (updated) {
        const atualizados = await this.repo.getLocal();
        this.todosNpcs = atualizados;
        this.processarCategorias(this.todosNpcs);
      }
    });

    if (locais.length === 0) {
      const online = await this.repo.forceFetch();
      this.todosNpcs = online;
      this.processarCategorias(this.todosNpcs);
    }
  }

  /** 🔧 Agrupa NPCs pelo campo `tipo`, filtrando por aba (classificacao) */
  private processarCategorias(lista: NpcDomain[]) {
    const estados = new Map(this.categorias.map((c) => [c.nome, c.expandido]));
    const mapa = new Map<string, NpcDomain[]>();

    lista
      .filter((npc) => {
        // filtro por aba
        const porClassificacao =
          this.abaAtiva === 'bestiais'
            ? npc.classificacao === 'Bestial'
            : npc.classificacao === 'Inimigo';

        // jogadores comuns só veem NPCs visíveis
        const porVisibilidade = this.ehMestre ? true : npc.visivel_jogadores;

        return porClassificacao && porVisibilidade;
      })
      .forEach((npc) => {
        const cat = npc.tipo || 'Comum';
        if (!mapa.has(cat)) mapa.set(cat, []);
        mapa.get(cat)!.push(npc);
      });

    this.categorias = Array.from(mapa.entries())
      // ordena na ordem fixa: Comum → Elite → Mágico → Lendário
      .sort(([a], [b]) => this.ordemTipos(a) - this.ordemTipos(b))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: estados.get(nome) ?? false,
      }));

    this.categoriasFiltradas = [...this.categorias];
  }

  private ordemTipos(tipo: string): number {
    const ordem = ['Comum', 'Elite', 'Mágico', 'Lendário'];
    const idx = ordem.indexOf(tipo);
    return idx >= 0 ? idx : 999; // tipos desconhecidos vão para o final
  }

  aplicarFiltro() {
    const termo = this.normalizarTexto(this.filtro);
    if (!termo) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map((c) => {
        const itensFiltrados = c.itens.filter((n) =>
          [n.nome, n.tipo, n.descricao, n.alinhamento, n.classificacao]
            .map((v) => this.normalizarTexto(String(v || '')))
            .some((texto) => texto.includes(termo))
        );
        return { ...c, itens: itensFiltrados, expandido: itensFiltrados.length > 0 };
      })
      .filter((c) => c.itens.length > 0);
  }

  private normalizarTexto(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  selecionarAba(aba: 'bestiais' | 'inimigos') {
    this.abaAtiva = aba;
    this.processarCategorias(this.todosNpcs); // 🔹 agora só reprocessa o cache
  }

  toggleCategoria(cat: CategoriaNpc) {
    cat.expandido = !cat.expandido;
  }

  abrirItem(npc: NpcDomain) {
    this.router.navigate(['/npc-detalhes', npc.id]);
  }

  novoNpc() {
    this.router.navigate(['/cadastro-npc']);
  }

  /** 👑 Apenas mestre pode alternar visibilidade */
  async toggleVisibilidade(event: Event, npc: NpcDomain) {
    event.stopPropagation(); // impede abrir o detalhe
    if (!this.ehMestre) return;

    this.loadingVisibilidade[npc.id] = true;
    try {
      const atualizado = await this.visibilidadeService.toggleVisibilidade(npc.index);
      if (atualizado) {
        npc.visivel_jogadores = atualizado.visivel_jogadores;
      }
    } catch (err) {
      console.error('[Npcs] Erro ao alternar visibilidade:', err);
    } finally {
      this.loadingVisibilidade[npc.id] = false;
    }
  }
}
