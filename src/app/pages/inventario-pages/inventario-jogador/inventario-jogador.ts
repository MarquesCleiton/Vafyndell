import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { InventarioDomain } from '../../../domain/InventarioDomain';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
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

  abas: Array<'recursos' | 'equipamentos' | 'pocoes' | 'outros'> = [
    'recursos', 'equipamentos', 'pocoes', 'outros'
  ];
  abaAtiva: 'recursos' | 'equipamentos' | 'pocoes' | 'outros' = 'recursos';

  resumo = { tipos: 0, unidades: 0, pesoTotal: 0, categorias: 0 };
  processando: { [id: string]: 'transferir' | 'editar' | 'excluir' | null } = {};

  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');

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

  constructor(private router: Router) { }

  async ngOnInit() {
    try {
      this.carregando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');
      await this.loadLocalAndSync(user.email);
    } finally {
      this.carregando = false;
    }
  }

  private async loadLocalAndSync(email: string) {
    const [catalogoLocal, inventarioLocal] = await Promise.all([
      this.catalogoRepo.getLocal(),
      this.inventarioRepo.getLocal(),
    ]);
    const meusItens = inventarioLocal.filter(i => i.jogador === email);
    this.processarInventario(meusItens, catalogoLocal);

    (async () => {
      const [catSync, invSync] = await Promise.all([
        this.catalogoRepo.sync(),
        this.inventarioRepo.sync(),
      ]);
      if (catSync || invSync) {
        const [catAtualizado, invAtualizado] = await Promise.all([
          this.catalogoRepo.getLocal(),
          this.inventarioRepo.getLocal(),
        ]);
        const meusAtualizados = invAtualizado.filter(i => i.jogador === email);
        this.processarInventario(meusAtualizados, catAtualizado);
      }
    })();
  }

  private processarInventario(inventarioBruto: InventarioDomain[], catalogo: CatalogoDomain[]) {
    const inventarioDetalhado: InventarioDetalhado[] = inventarioBruto.map(inv => {
      const detalhe = catalogo.find(c => String(c.id) === String(inv.item_catalogo));
      return { ...inv, itemDetalhe: detalhe };
    });

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
      (sum, i) => sum + (i.quantidade || 0) * (i.itemDetalhe?.peso || 0), 0);
    this.resumo.categorias = this.categorias.length;
  }

  aplicarFiltro() {
    const termo = this.normalizarTexto(this.filtro);
    if (!termo) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }
    this.categoriasFiltradas = this.categorias
      .map(c => {
        const itensFiltrados = c.itens.filter(i =>
          [
            i.itemDetalhe?.nome,
            i.itemDetalhe?.raridade,
            i.itemDetalhe?.efeito,
            i.itemDetalhe?.colateral,
            i.itemDetalhe?.categoria,
          ]
            .map(v => this.normalizarTexto(String(v || '')))
            .some(texto => texto.includes(termo))
        );
        return { ...c, itens: itensFiltrados, expandido: itensFiltrados.length > 0 };
      })
      .filter(c => c.itens.length > 0);
  }

  private normalizarTexto(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  selecionarAba(aba: 'recursos' | 'equipamentos' | 'pocoes' | 'outros') { this.abaAtiva = aba; }

  pertenceAba(categoria?: string): boolean {
    if (!categoria) return this.abaAtiva === 'outros';
    return this.mapaAbas[this.abaAtiva].includes(categoria);
  }

  toggleCategoria(cat: CategoriaInventario) { cat.expandido = !cat.expandido; }

  getQuantidadePorAba(aba: 'recursos' | 'equipamentos' | 'pocoes' | 'outros'): number {
    const categoriasAba = this.mapaAbas[aba];
    let count = 0;
    this.categorias.forEach(cat => {
      if (categoriasAba.includes(cat.nome)) count += cat.itens.length;
    });
    return count;
  }

  getRaridadeClass(raridade?: string): string {
    if (!raridade) return 'comum';
    return raridade.toLowerCase();
  }

  getEmojiFallback(categoria?: string): string {
    if (!categoria) return '📦';
    const mapa: Record<string, string> = {
      recursos: '🌿', equipamentos: '⚔️', pocoes: '🧪', outros: '📦'
    };
    for (const aba of Object.keys(this.mapaAbas)) {
      if (this.mapaAbas[aba].includes(categoria)) {
        return mapa[aba as keyof typeof mapa];
      }
    }
    return '📦';
  }

  abrirItem(itemId: string) { this.router.navigate(['/item-inventario', itemId]); }
  novoItemInventario() { this.router.navigate(['/cadastro-inventario']); }

  trocarItem(itemId: string, event: Event) {
    event.stopPropagation();
    this.processando[itemId] = 'transferir';
    setTimeout(() => { this.router.navigate(['/troca-de-itens', itemId]); this.processando[itemId] = null; }, 400);
  }

  editarItem(id: string, event: Event) {
    event.stopPropagation();
    this.processando[id] = 'editar';
    setTimeout(() => { this.router.navigate(['/cadastro-inventario', id]); this.processando[id] = null; }, 400);
  }

  async excluirItem(id: string, event: Event) {
    event.stopPropagation();
    const confirmar = confirm('🗑️ Deseja excluir este item do inventário?');
    if (!confirmar) return;

    this.processando[id] = 'excluir';
    try {
      await this.inventarioRepo.delete(id);
      alert('✅ Item excluído do inventário!');

      // Atualiza lista removendo o item excluído
      this.categorias = this.categorias.map(c => ({
        ...c,
        itens: c.itens.filter(i => i.id !== id),
      }));
      this.aplicarFiltro(); // reaplica filtro para atualizar categoriasFiltradas
      this.calcularResumo();
    } catch (err) {
      console.error('[Inventário] Erro ao excluir:', err);
      alert('❌ Erro ao excluir item');
    } finally {
      this.processando[id] = null;
    }
  }
}
