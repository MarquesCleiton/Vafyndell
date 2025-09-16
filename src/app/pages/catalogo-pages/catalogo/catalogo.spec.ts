import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';

interface CategoriaCatalogo {
  nome: string;
  itens: CatalogoDomain[];
  expandido: boolean;
}

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo.html',
  styleUrls: ['./catalogo.css'],
})
export class Catalogo implements OnInit {
  categorias: CategoriaCatalogo[] = [];
  categoriasFiltradas: CategoriaCatalogo[] = [];
  carregando = true;
  filtro = '';

  abaAtiva: 'recursos' | 'equipamentos' | 'pocoes' | 'outros' = 'recursos';

  private repo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');

  // mapeamento: categorias → abas
  private mapaAbas: Record<string, string[]> = {
    recursos: ['Recursos botânicos', 'Mineral', 'Componentes bestiais e animalescos', 'Tesouro', 'Moeda'],
    equipamentos: ['Equipamento', 'Ferramentas', 'Utilitário – Bombas, armadilhas, luz, som, gás, adesivos'],
    pocoes: [
      'Poção de Cura – Regenera vida, cicatriza feridas',
      'Poção Mental – Calmante, foco, memória, sono, esquecimento',
      'Poção de Aprimoramento Físico – Força, resistência, agilidade',
      'Poção Sensorial – Visão, audição, percepção, voz, respiração',
      'Poção de Furtividade – Camuflagem, passos suaves, silêncio',
      'Poção de Energia – Percepção da energia fundamental',
      'Veneno – Sonolência, confusão ou morte',
    ],
    outros: ['Outros'],
  };

  constructor(private router: Router) {}

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();
    } catch (err) {
      console.error('[Catalogo] Erro ao carregar itens:', err);
    } finally {
      this.carregando = false;
    }
  }

  private async loadLocalAndSync() {
    const locais = await this.repo.getLocal();
    this.processarItens(locais);

    this.repo.sync().then(async (updated) => {
      if (updated) {
        const atualizados = await this.repo.getLocal();
        this.processarItens(atualizados);
      }
    });

    if (locais.length === 0) {
      const online = await this.repo.forceFetch();
      this.processarItens(online);
    }
  }

  private processarItens(lista: CatalogoDomain[]) {
    const estados = new Map(this.categorias.map(c => [c.nome, c.expandido]));
    const mapa = new Map<string, CatalogoDomain[]>();

    lista.forEach((item) => {
      const cat = item.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(item);
    });

    this.categorias = Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: estados.get(nome) ?? false,
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
          (i) =>
            String(i.nome || '').toLowerCase().includes(termo) ||
            String(i.raridade || '').toLowerCase().includes(termo) ||
            String(i.efeito || '').toLowerCase().includes(termo) ||
            String(i.colateral || '').toLowerCase().includes(termo) ||
            String(i.categoria || '').toLowerCase().includes(termo)
        ),
      }))
      .filter((c) => c.itens.length > 0);
  }

  selecionarAba(aba: 'recursos' | 'equipamentos' | 'pocoes' | 'outros') {
    this.abaAtiva = aba;
  }

  pertenceAba(categoria: string): boolean {
    return this.mapaAbas[this.abaAtiva].includes(categoria);
  }

  toggleCategoria(cat: CategoriaCatalogo) {
    cat.expandido = !cat.expandido;
  }

  abrirItem(item: CatalogoDomain) {
    this.router.navigate(['/item-catalogo', item.id]);
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo']);
  }

  getRaridadeClass(raridade: any): string {
    if (!raridade) return 'comum';
    return String(raridade).toLowerCase();
  }
}
