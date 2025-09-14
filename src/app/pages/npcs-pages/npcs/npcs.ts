import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BaseRepository } from '../../../repositories/BaseRepository';
import { NpcDomain } from '../../../domain/NpcDomain';

interface CategoriaNpc {
  nome: string;
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

  // ✅ Reuso do BaseRepository genérico
  private repo = new BaseRepository<NpcDomain>(
    'NPCs',
    'NPCs'
  );

  constructor(private router: Router) { }

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();
    } catch (err) {
      console.error('[Npcs] Erro ao carregar NPCs:', err);
    } finally {
      this.carregando = false;
    }
  }

  /** 🔄 Carrega do cache e sincroniza em paralelo */
  private async loadLocalAndSync() {
    // 1. Carrega cache local
    const locais = await this.repo.getLocal();
    this.processarCategorias(locais);

    // 2. Sincroniza em paralelo
    this.repo.sync().then(async (updated) => {
      if (updated) {
        const atualizados = await this.repo.getLocal();
        this.processarCategorias(atualizados);
      }
    });

    // 3. Se não havia nada local, força fetch
    if (locais.length === 0) {
      const online = await this.repo.forceFetch();
      this.processarCategorias(online);
    }
  }

  /** Agrupa NPCs por categoria */
  private processarCategorias(lista: NpcDomain[]) {
    // 👇 Guarda o estado expandido das categorias já renderizadas
    const estados = new Map(this.categorias.map(c => [c.nome, c.expandido]));

    const mapa = new Map<string, NpcDomain[]>();
    lista.forEach((npc) => {
      const cat = npc.classificacao || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(npc);
    });

    this.categorias = Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: estados.get(nome) ?? false, // 👈 reaproveita o estado anterior
      }));

    this.categoriasFiltradas = [...this.categorias];
  }

  aplicarFiltro() {
    const termo = this.filtro.toLowerCase().trim();
    if (!termo) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map((c) => ({
        ...c,
        itens: c.itens.filter(
          (n) =>
            n.nome?.toLowerCase().includes(termo) ||
            n.tipo?.toLowerCase().includes(termo) ||
            n.descricao?.toLowerCase().includes(termo) ||
            n.alinhamento?.toLowerCase().includes(termo)
        ),
      }))
      .filter((c) => c.itens.length > 0);
  }

  toggleCategoria(cat: CategoriaNpc) {
    cat.expandido = !cat.expandido;
  }

  abrirItem(npc: NpcDomain) {
    this.router.navigate(['/npc-detalhes', npc.id], {
      queryParams: { returnUrl: '/npcs' },
    });
  }

  novoNpc() {
    this.router.navigate(['/cadastro-npc']);
  }
}
