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

  constructor(private router: Router) { }

  async ngOnInit() {

    try {
      this.carregando = true;
      await CatalogoRepository.syncItens();
      const itens = await CatalogoRepository.getLocalItens();

      // Agrupa por categoria
      const mapa = new Map<string, CatalogoDomain[]>();
      itens.forEach(i => {
        if (!mapa.has(i.categoria)) {
          mapa.set(i.categoria || 'Outros', []);
        }
        mapa.get(i.categoria || 'Outros')!.push(i);
      });

      this.categorias = Array.from(mapa.entries())
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        .map(([nome, itens]) => ({
          nome: String(nome || 'Outros'),
          itens,
          expandido: false,
        }));

      this.categoriasFiltradas = [...this.categorias];
    } catch (err) {
      console.error('[Catalogo] Erro ao carregar itens:', err);
    } finally {
      this.carregando = false;
    }
  }

  toggleCategoria(cat: any) {
    cat.expandido = !cat.expandido;
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo']);
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
          String(i.colateral || '').toLowerCase().includes(termo)
        ),
      }))
      .filter(c => c.itens.length > 0);
  }


  /** ✅ Método seguro para retornar classe de raridade */
  getRaridadeClass(raridade: any): string {
    if (!raridade) return 'comum';
    return String(raridade).toLowerCase();
  }
  
  abrirItem(item: any) {
    this.router.navigate(['/item-catalogo', item.id]);
  }
}
