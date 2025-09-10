import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { OficinaService } from '../../services/OficinaService';

@Component({
  selector: 'app-oficina',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './oficina.html',
  styleUrls: ['./oficina.css'],
})
export class Oficina implements OnInit {
  categorias: { nome: string; itens: (CatalogoDomain & { fabricavel: boolean })[]; expandido: boolean }[] = [];
  categoriasFiltradas: { nome: string; itens: (CatalogoDomain & { fabricavel: boolean })[]; expandido: boolean }[] = [];

  carregando = true;
  filtro = '';
  fabricaveisOnly = false;

  constructor(private router: Router, private oficinaService: OficinaService) {}

  async ngOnInit() {
    try {
      this.carregando = true;
      const receitas = await this.oficinaService.getPossiveisReceitas();
      this.processarItens(receitas);
      this.carregando = false;
    } catch (err) {
      console.error('[Oficina] Erro ao carregar receitas:', err);
      this.carregando = false;
    }
  }

  private processarItens(itens: (CatalogoDomain & { fabricavel: boolean })[]) {
    const mapa = new Map<string, (CatalogoDomain & { fabricavel: boolean })[]>();

    itens.forEach(i => {
      const cat = i.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: false,
      }));

    this.categoriasFiltradas = [...this.categorias];
  }

  toggleCategoria(cat: any) {
    cat.expandido = !cat.expandido;
  }

  aplicarFiltro() {
    const termo = this.normalize(this.filtro);
    if (!termo && !this.fabricaveisOnly) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map(c => {
        const itens = c.itens.filter(i =>
          (!this.fabricaveisOnly || i.fabricavel) &&
          (this.normalize(i.nome).includes(termo) ||
           this.normalize(i.raridade).includes(termo) ||
           this.normalize(i.efeito).includes(termo) ||
           this.normalize(i.descricao).includes(termo))
        );
        return { ...c, itens, expandido: true };
      })
      .filter(c => c.itens.length > 0);
  }

  normalize(text: string = ''): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  getRaridadeClass(raridade: string): string {
    if (!raridade) return 'comum';
    return raridade.toLowerCase();
  }
}
