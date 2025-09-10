import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InventarioRepository } from '../../repositories/InventarioRepository';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { InventarioDomain } from '../../domain/InventarioDomain';
import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { AuthService } from '../../core/auth/AuthService';

interface InventarioDetalhado extends InventarioDomain {
  itemDetalhe?: CatalogoDomain;
}

@Component({
  selector: 'app-inventario-jogador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario-jogador.html',
  styleUrls: ['./inventario-jogador.css'],
})
export class InventarioJogador implements OnInit {
  categorias: { nome: string; itens: InventarioDetalhado[]; expandido: boolean }[] = [];
  categoriasFiltradas: { nome: string; itens: InventarioDetalhado[]; expandido: boolean }[] = [];
  carregando = true;
  filtro = '';

  resumo = {
    tipos: 0,
    unidades: 0,
    pesoTotal: 0,
    categorias: 0,
  };

  constructor(private router: Router) { }

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

  async ngOnInit() {
    try {
      console.log('[InventarioJogador] Iniciando carregamento...');
      this.carregando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // 1. Sempre tenta catálogo primeiro
      const catalogoLocal = await CatalogoRepository.getLocalItens();

      // 2. Depois inventário local
      const inventarioLocal = await InventarioRepository.getLocalInventarioByJogador(user.email);

      if (catalogoLocal?.length && inventarioLocal?.length) {
        console.log('[InventarioJogador] Dados locais encontrados.');
        this.processarInventario(inventarioLocal, catalogoLocal);
        this.carregando = false;
      }

      // 3. Sincronização → garante ordem: catálogo → inventário
      (async () => {
        const catSync = await CatalogoRepository.syncItens();
        const invSync = await InventarioRepository.syncInventario();

        if (catSync || invSync) {
          console.log('[InventarioJogador] Sync trouxe alterações. Atualizando cache...');
          const catalogoAtualizado = await CatalogoRepository.getLocalItens();
          const inventarioAtualizado = await InventarioRepository.getLocalInventarioByJogador(user.email);
          this.processarInventario(inventarioAtualizado, catalogoAtualizado);
        } else {
          console.log('[InventarioJogador] Sync concluído. Nenhuma alteração detectada.');
        }
      })();

      // 4. Fallback online se nada local existir
      if (!inventarioLocal?.length) {
        console.log('[InventarioJogador] Nenhum inventário local. Forçando fetch online...');
        await CatalogoRepository.forceFetchItens();
        const catalogoOnline = await CatalogoRepository.getLocalItens();

        const inventarioOnline = await InventarioRepository.forceFetchInventario();
        this.processarInventario(inventarioOnline, catalogoOnline);

        this.carregando = false;
      }
    } catch (err) {
      console.error('[InventarioJogador] Erro ao carregar inventário:', err);
      this.carregando = false;
    }
  }


  /** Função auxiliar para montar categorias e resumo */
  private processarInventario(inventarioBruto: InventarioDomain[], catalogo: CatalogoDomain[]) {
    const inventarioDetalhado: InventarioDetalhado[] = inventarioBruto.map(inv => {
      const detalhe = catalogo.find(c => c.id === inv.item_catalogo);
      return { ...inv, itemDetalhe: detalhe };
    });

    const mapa = new Map<string, InventarioDetalhado[]>();
    inventarioDetalhado.forEach(i => {
      const cat = i.itemDetalhe?.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries())
      .sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || '')))
      .map(([nome, itens]) => ({ nome: String(nome || 'Outros'), itens, expandido: false }));

    this.categoriasFiltradas = [...this.categorias];
    this.calcularResumo();
  }

  toggleCategoria(cat: any) {
    cat.expandido = !cat.expandido;
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

  abrirItem(itemId: number) {
    this.router.navigate(['/item-inventario', itemId]);
  }

  novoItemInventario() {
    this.router.navigate(['/cadastro-inventario']);
  }
}
