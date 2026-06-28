import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { JogadorDomain } from '../../../domain/jogadorDomain';
import { AuthService } from '../../../core/auth/AuthService';
import { VisibilidadeService } from '../../../services/VisibilidadeService';
import { ImageModal } from '../../image-modal/image-modal';
import { ReceitaDomain } from '../../../domain/ReceitaDomain';

interface CategoriaCatalogo {
  nome: string;
  itens: CatalogoDomain[];
  expandido: boolean;
}

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageModal],
  templateUrl: './catalogo.html',
  styleUrls: ['./catalogo.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Catalogo implements OnInit {
  categorias: CategoriaCatalogo[] = [];
  categoriasFiltradas: CategoriaCatalogo[] = [];
  carregando = true;
  filtro = '';
  itemSelecionado: CatalogoDomain | null = null;
  imagemSelecionada: string | null = null;
  modalAbertoImagem = false;
  ingredientesDetalhados: { item: CatalogoDomain; quantidade: number }[] = [];
  receitasAssociadas: { produto: CatalogoDomain; quantidade: number }[] = [];

  abas: Array<'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros' | 'ocultos'> = [
    'tudo', 'recursos', 'equipamentos', 'pocoes', 'outros', 'ocultos'
  ];
  abaAtiva: 'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros' | 'ocultos' = 'tudo';

  private repo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private jogadorRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private repoReceitas = new BaseRepositoryV2<ReceitaDomain>('Receitas');
  private visibilidadeService = new VisibilidadeService<CatalogoDomain>(this.repo);
  private todosItens: CatalogoDomain[] = []; // cache local em memória

  ehMestre = false;
  loadingVisibilidade: Record<string, boolean> = {};

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

  constructor(private router: Router, private cdr: ChangeDetectorRef) { }

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.definirSeEhMestre();
      await this.loadLocalAndSync();
    } catch (err) {
      console.error('[Catalogo] Erro ao carregar itens:', err);
    } finally {
      this.carregando = false;
      this.cdr.markForCheck();
    }
  }

  /** Define se o usuário atual é Mestre */
  private async definirSeEhMestre() {
    const user = AuthService.getUser();
    if (user?.email) {
      const jogadores = await this.jogadorRepo.getLocal();
      const jogadorAtual = jogadores.find((j) => j.email === user.email);
      this.ehMestre = jogadorAtual?.tipo_jogador === 'Mestre';
      console.log(`[Catalogo] 👑 Usuário é mestre? ${this.ehMestre}`);
      this.cdr.markForCheck();
    }
  }

  private async loadLocalAndSync() {
    console.log('[Catalogo] 📂 Carregando itens locais...');
    const locais = await this.repo.getLocal();
    this.todosItens = locais;                    // 🔹 salva no cache
    this.processarItens(this.todosItens);

    // sync em paralelo
    this.repo.sync().then(async (updated) => {
      if (updated) {
        console.log('[Catalogo] 🔄 Itens atualizados no servidor, recarregando...');
        const atualizados = await this.repo.getLocal();
        this.todosItens = atualizados;           // 🔹 atualiza cache
        this.processarItens(this.todosItens);
        this.cdr.markForCheck();
      }
    });

    // se vazio local → força online
    if (locais.length === 0) {
      console.log('[Catalogo] 🌐 Nenhum item local, forçando fetch online...');
      const online = await this.repo.forceFetch();
      this.todosItens = online;                  // 🔹 atualiza cache
      this.processarItens(this.todosItens);
    }
    
    this.cdr.markForCheck();
  }


  private processarItens(lista: CatalogoDomain[]) {
    console.log(`[Catalogo] Processando ${lista.length} itens...`);
    const estados = new Map(this.categorias.map((c) => [c.nome, c.expandido]));
    const mapa = new Map<string, CatalogoDomain[]>();

    lista
      .filter((item) => {
        if (this.abaAtiva === 'ocultos') {
          return this.ehMestre && !item.visivel_jogadores;
        }
        return this.ehMestre ? true : item.visivel_jogadores;
      })
      .forEach((item) => {
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
    this.cdr.markForCheck();
  }


  aplicarFiltro() {
    const termo = this.normalizarTexto(this.filtro);
    if (termo) {
      this.abaAtiva = 'tudo'; // Força aba TUDO na pesquisa
    }
    if (!termo) {
      this.categoriasFiltradas = [...this.categorias];
      this.cdr.markForCheck();
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map((c) => {
        const itensFiltrados = c.itens.filter((i) =>
          [i.nome, i.raridade, i.efeito, i.colateral, i.categoria]
            .map((v) => this.normalizarTexto(String(v || '')))
            .some((texto) => texto.includes(termo))
        );

        return {
          ...c,
          itens: itensFiltrados,
          expandido: itensFiltrados.length > 0,
        };
      })
      .filter((c) => c.itens.length > 0);
    this.cdr.markForCheck();
  }

  /** 🔠 Remove acentuação e normaliza para minúsculo */
  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  selecionarAba(aba: 'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros' | 'ocultos') {
    this.abaAtiva = aba;
    this.processarItens(this.todosItens); // 🔹 sempre reprocessa o cache
    this.cdr.markForCheck();
  }

  pertenceAba(categoria: string): boolean {
    if (this.abaAtiva === 'tudo') return true;
    if (this.abaAtiva === 'ocultos') return true; // ocultos processa todos ocultados na filtragem geral
    return this.mapaAbas[this.abaAtiva]?.includes(categoria) || false;
  }

  getQuantidadePorAba(aba: 'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros' | 'ocultos'): number {
    const listaFiltradaPorAba = this.todosItens.filter((item) => {
      if (this.abaAtiva === 'ocultos') return this.ehMestre && !item.visivel_jogadores;
      return this.ehMestre ? true : item.visivel_jogadores;
    });

    if (aba === 'tudo') {
      return listaFiltradaPorAba.length;
    }
    if (aba === 'ocultos') {
      return this.todosItens.filter(item => !item.visivel_jogadores).length;
    }

    const categoriasAba = this.mapaAbas[aba];
    return listaFiltradaPorAba.filter(item => item.categoria && categoriasAba?.includes(item.categoria)).length;
  }

  toggleCategoria(cat: CategoriaCatalogo) {
    cat.expandido = !cat.expandido;
    this.cdr.markForCheck();
  }

  async abrirItem(item: CatalogoDomain) {
    this.itemSelecionado = item;
    this.cdr.markForCheck();
    await this.carregarReceitas(String(item.id));
  }

  private async carregarReceitas(itemId: string) {
    this.ingredientesDetalhados = [];
    this.receitasAssociadas = [];
    try {
      const [receitas, catalogo] = await Promise.all([
        this.repoReceitas.getLocal(),
        this.repo.getLocal()
      ]);

      // 1) Ingredientes do item
      const doItem = receitas.filter(r => String(r.fabricavel) === String(itemId));
      this.ingredientesDetalhados = doItem.map(rec => {
        const ingItem = catalogo.find(c => String(c.id) === String(rec.catalogo));
        return {
          item: ingItem || ({} as CatalogoDomain),
          quantidade: rec.quantidade,
        };
      });

      // 2) Receitas em que ele é ingrediente
      const usadasEm = receitas.filter(r => String(r.catalogo) === String(itemId));
      this.receitasAssociadas = usadasEm.map(rec => {
        const produto = catalogo.find(c => String(c.id) === String(rec.fabricavel));
        return {
          produto: produto || ({} as CatalogoDomain),
          quantidade: rec.quantidade,
        };
      });
      this.cdr.markForCheck();
    } catch (err) {
      console.error('[Catalogo] Erro ao carregar receitas:', err);
    }
  }

  abrirImagem(src: string | undefined, event?: Event) {
    if (!src || src === '-') return;
    if (event) event.stopPropagation();
    this.imagemSelecionada = src;
    this.modalAbertoImagem = true;
    this.cdr.markForCheck();
  }

  fecharModalImagem() {
    this.imagemSelecionada = null;
    this.modalAbertoImagem = false;
    this.cdr.markForCheck();
  }

  editarItem(id: any, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/cadastro-item-catalogo', String(id)]);
  }

  async excluirItem(id: any) {
    const confirmacao = confirm(`🗑️ Deseja realmente excluir este item do catálogo?`);
    if (!confirmacao) return;
    try {
      await this.repo.delete(id);
      alert('✅ Item excluído com sucesso!');
      this.itemSelecionado = null;
      this.todosItens = this.todosItens.filter(i => String(i.id) !== String(id));
      this.processarItens(this.todosItens);
    } catch (err) {
      console.error('[Catalogo] Erro ao excluir item:', err);
      alert('❌ Erro ao excluir item. Veja o console.');
    }
  }

  async excluirItemDesdeCard(id: any, nome: string, event: Event) {
    event.stopPropagation();
    const confirmacao = confirm(`🗑️ Deseja realmente excluir o item "${nome}" do catálogo?`);
    if (!confirmacao) return;
    try {
      await this.repo.delete(id);
      alert('✅ Item excluído com sucesso!');
      if (this.itemSelecionado && String(this.itemSelecionado.id) === String(id)) {
        this.itemSelecionado = null;
      }
      this.todosItens = this.todosItens.filter(i => String(i.id) !== String(id));
      this.processarItens(this.todosItens);
    } catch (err) {
      console.error('[Catalogo] Erro ao excluir item:', err);
      alert('❌ Erro ao excluir item. Veja o console.');
    }
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo']);
  }

  getRaridadeClass(raridade: any): string {
    if (!raridade) return 'comum';
    return String(raridade).toLowerCase();
  }

  /** 👑 Apenas mestre pode alternar visibilidade */
  async toggleVisibilidade(event: Event, item: CatalogoDomain) {
    event.stopPropagation();
    if (!this.ehMestre) return;

    this.loadingVisibilidade[item.id] = true;
    try {
      // ⚠️ Ajustar VisibilidadeService para BaseRepositoryV2 (usar id, não index)
      const atualizado = await this.visibilidadeService.toggleVisibilidade(item.id);
      if (atualizado) {
        item.visivel_jogadores = atualizado.visivel_jogadores;
      }
    } catch (err) {
      console.error('[Catalogo] Erro ao alternar visibilidade:', err);
    } finally {
      this.loadingVisibilidade[item.id] = false;
      this.cdr.markForCheck();
    }
  }

  getEmojiFallback(categoria?: string): string {
    if (!categoria) return '📦'; // padrão

    const mapa: Record<string, string> = {
      recursos: '🌿',
      equipamentos: '⚔️',
      pocoes: '🧪',
      outros: '📦',
      ocultos: '🙈',
    };

    // verifica em qual aba a categoria se encaixa
    for (const aba of Object.keys(this.mapaAbas)) {
      if (this.mapaAbas[aba].includes(categoria)) {
        return mapa[aba as keyof typeof mapa];
      }
    }

    return '📦'; // fallback
  }

}
