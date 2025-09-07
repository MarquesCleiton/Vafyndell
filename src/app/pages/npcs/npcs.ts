import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NpcRepository } from '../../repositories/NpcRepository';
import { NpcDomain } from '../../domain/NpcDomain';

@Component({
  selector: 'app-npcs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './npcs.html',
  styleUrls: ['./npcs.css'],
})
export class Npcs implements OnInit {
  categorias: { nome: string; itens: NpcDomain[]; expandido: boolean }[] = [];
  categoriasFiltradas: { nome: string; itens: NpcDomain[]; expandido: boolean }[] = [];
  carregando = true;
  filtro = '';

  constructor(private router: Router) { }

  async ngOnInit() {
    try {
      this.carregando = true;

      // 1. Carrega local
      const locais = await NpcRepository.getLocalNpcs();
      this.processarCategorias(locais);

      // 2. Faz sync em paralelo
      NpcRepository.syncNpcs().then(async updated => {
        if (updated) {
          const atualizados = await NpcRepository.getLocalNpcs();
          this.processarCategorias(atualizados);
        }
      });

      // 3. Se não havia nada local, força fetch
      if (locais.length === 0) {
        const online = await NpcRepository.forceFetchNpcs();
        this.processarCategorias(online);
      }
    } catch (err) {
      console.error('[Npcs] Erro ao carregar NPCs:', err);
    } finally {
      this.carregando = false;
    }
  }

  private processarCategorias(lista: NpcDomain[]) {
    const mapa = new Map<string, NpcDomain[]>();
    lista.forEach(npc => {
      const cat = npc.classificacao || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(npc);
    });

    this.categorias = Array.from(mapa.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([nome, itens]) => ({ nome, itens, expandido: false }));

    this.categoriasFiltradas = [...this.categorias];
  }

  aplicarFiltro() {
    const termo = this.filtro.toLowerCase();
    if (!termo) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map(c => ({
        ...c,
        itens: c.itens.filter(n =>
          String(n.nome || '').toLowerCase().includes(termo) ||
          String(n.tipo || '').toLowerCase().includes(termo) ||
          String(n.descricao || '').toLowerCase().includes(termo) ||
          String(n.alinhamento || '').toLowerCase().includes(termo)
        ),
      }))
      .filter(c => c.itens.length > 0);
  }

  toggleCategoria(cat: any) {
    cat.expandido = !cat.expandido;
  }

  abrirItem(npc: NpcDomain) {
    this.router.navigate(
      ['/npc-detalhes', npc.id],
      { queryParams: { returnUrl: '/npcs' } } // 👈 opcional: volta para a listagem depois
    );
  }


  novoNpc() {
    this.router.navigate(['/cadastro-npc']);
  }
}
