import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { Router } from '@angular/router';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html',
  styleUrls: ['./catalogo.css'],
})
export class Catalogo implements OnInit {
  categorias: { nome: string; itens: CatalogoDomain[]; expandido: boolean }[] = [];
  categoriasFiltradas: { nome: string; itens: CatalogoDomain[]; expandido: boolean }[] = [];
  carregando = true;
  filtro = '';

  constructor(private router: Router) {}

async ngOnInit() {
  try {
    console.log('[Catalogo] Iniciando carregamento...');
    this.carregando = true;

    // 1. Carrega itens locais primeiro
    let itens = await CatalogoRepository.getLocalItens();
    if (itens.length) {
      console.log('[Catalogo] Itens locais encontrados:', itens.length);
      this.processarItens(itens);
      this.carregando = false;
    }

    // 2. Em paralelo, sincroniza
    CatalogoRepository.syncItens().then(async updated => {
      if (updated) {
        console.log('[Catalogo] Sync trouxe alterações. Recarregando...');
        const atualizados = await CatalogoRepository.getLocalItens();
        this.processarItens(atualizados);
      }
    });

    // 3. Se não havia nada local, força buscar online
    if (!itens.length) {
      console.log('[Catalogo] Nenhum item local. Buscando online...');
      const online = await CatalogoRepository.forceFetchItens();
      this.processarItens(online);
      this.carregando = false;
    }
  } catch (err) {
    console.error('[Catalogo] Erro ao carregar itens:', err);
    this.carregando = false;
  }
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
        String(i.nome || '').toLowerCase().includes(termo) ||
        String(i.raridade || '').toLowerCase().includes(termo) ||
        String(i.efeito || '').toLowerCase().includes(termo) ||
        String(i.colateral || '').toLowerCase().includes(termo) ||
        String(i.categoria || '').toLowerCase().includes(termo)
      ),
    }))
    .filter(c => c.itens.length > 0);
}

abrirItem(item: CatalogoDomain) {
  this.router.navigate(['/item-catalogo', item.id]);
}


  /** 🔄 Função auxiliar para agrupar itens por categoria */
  private processarItens(itens: CatalogoDomain[]) {
    const mapa = new Map<string, CatalogoDomain[]>();
    itens.forEach(i => {
      const cat = i.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([nome, itens]) => ({
        nome: String(nome || 'Outros'),
        itens,
        expandido: false,
      }));

    this.categoriasFiltradas = [...this.categorias];
  }

  toggleCategoria(cat: any) {
    cat.expandido = !cat.expandido;
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo']);
  }


  /** ✅ Método seguro para retornar classe de raridade */
  getRaridadeClass(raridade: any): string {
    if (!raridade) return 'comum';
    return String(raridade).toLowerCase();
  }
}
