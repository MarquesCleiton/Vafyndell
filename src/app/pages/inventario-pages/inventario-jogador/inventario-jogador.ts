import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InventarioDomain } from '../../../domain/InventarioDomain';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';
import { AuthService } from '../../../core/auth/AuthService';

interface InventarioDetalhado extends InventarioDomain {
  itemDetalhe?: CatalogoDomain;
}

interface CategoriaInventario {
  nome: string;
  itens: InventarioDetalhado[];
  expandido: boolean;
}

@Component({
  selector: 'app-inventario-jogador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario-jogador.html',
  styleUrls: ['./inventario-jogador.css'],
})
export class InventarioJogador implements OnInit {
  categorias: CategoriaInventario[] = [];
  categoriasFiltradas: CategoriaInventario[] = [];
  carregando = true;
  filtro = '';

  resumo = {
    tipos: 0,
    unidades: 0,
    pesoTotal: 0,
    categorias: 0,
  };

  // ✅ Agora usando o BaseRepository
  private catalogoRepo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');
  private inventarioRepo = new BaseRepository<InventarioDomain>('Inventario', 'Inventario');

  constructor(private router: Router) {}

  async ngOnInit() {
    try {
      console.log('[InventarioJogador] Iniciando carregamento...');
      this.carregando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      await this.loadLocalAndSync(user.email);
    } catch (err) {
      console.error('[InventarioJogador] Erro ao carregar inventário:', err);
    } finally {
      this.carregando = false;
    }
  }

  /** 🔄 Carrega catálogo e inventário do cache, depois sincroniza */
  private async loadLocalAndSync(email: string) {
    // 1. Carrega cache local
    const [catalogoLocal, inventarioLocal] = await Promise.all([
      this.catalogoRepo.getLocal(),
      this.inventarioRepo.getLocal(),
    ]);

    const meusItens = inventarioLocal.filter(i => i.jogador === email);
    this.processarInventario(meusItens, catalogoLocal);

    // 2. Sincroniza em paralelo (catálogo primeiro, depois inventário)
    (async () => {
      const catSync = await this.catalogoRepo.sync();
      const invSync = await this.inventarioRepo.sync();

      if (catSync || invSync) {
        console.log('[InventarioJogador] Sync trouxe alterações.');
        const [catAtualizado, invAtualizado] = await Promise.all([
          this.catalogoRepo.getLocal(),
          this.inventarioRepo.getLocal(),
        ]);
        const meusAtualizados = invAtualizado.filter(i => i.jogador === email);
        this.processarInventario(meusAtualizados, catAtualizado);
      }
    })();

    // 3. Se não havia nada local, força fetch online
    if (!meusItens.length) {
      console.log('[InventarioJogador] Nenhum inventário local. Forçando fetch online...');
      await this.catalogoRepo.forceFetch();
      const catalogoOnline = await this.catalogoRepo.getLocal();

      await this.inventarioRepo.forceFetch();
      const inventarioOnline = await this.inventarioRepo.getLocal();
      const meusOnline = inventarioOnline.filter(i => i.jogador === email);

      this.processarInventario(meusOnline, catalogoOnline);
    }
  }

  /** 🔧 Monta categorias e resumo */
  private processarInventario(inventarioBruto: InventarioDomain[], catalogo: CatalogoDomain[]) {
    const inventarioDetalhado: InventarioDetalhado[] = inventarioBruto.map(inv => {
      const detalhe = catalogo.find(c => c.id === inv.item_catalogo);
      return { ...inv, itemDetalhe: detalhe };
    });

    // preserva expandido
    const estados = new Map(this.categorias.map(c => [c.nome, c.expandido]));

    const mapa = new Map<string, InventarioDetalhado[]>();
    inventarioDetalhado.forEach(i => {
      const cat = i.itemDetalhe?.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: estados.get(nome) ?? false,
      }));

    this.categoriasFiltradas = [...this.categorias];
    this.calcularResumo();
  }

  private calcularResumo() {
    const todosItens = this.categorias.flatMap(c => c.itens);

    this.resumo.tipos = todosItens.length;
    this.resumo.unidades = todosItens.reduce((sum, i) => sum + (i.quantidade || 0), 0);
    this.resumo.pesoTotal = todosItens.reduce(
      (sum, i) => sum + ((i.quantidade || 0) * (i.itemDetalhe?.peso || 0)),
      0
    );
    this.resumo.categorias = this.categorias.length;
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
        itens: c.itens.filter(i =>
          String(i.itemDetalhe?.nome || '').toLowerCase().includes(termo) ||
          String(i.itemDetalhe?.raridade || '').toLowerCase().includes(termo) ||
          String(i.itemDetalhe?.categoria || '').toLowerCase().includes(termo)
        ),
      }))
      .filter(c => c.itens.length > 0);
  }

  toggleCategoria(cat: CategoriaInventario) {
    cat.expandido = !cat.expandido;
  }

  abrirItem(itemId: string) {
    this.router.navigate(['/item-inventario', itemId], {
      queryParams: { returnUrl: '/inventario-jogador' },
    });
  }

  novoItemInventario() {
    this.router.navigate(['/cadastro-inventario']);
  }
}
