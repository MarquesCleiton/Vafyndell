import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { JogadorDomain } from '../../../domain/jogadorDomain';
import { InventarioDomain } from '../../../domain/InventarioDomain';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { Location } from '@angular/common';

import { SkillTree } from '../../skilltree/skilltree/skilltree';
import { ImageModal } from '../../image-modal/image-modal';
import { ReceitaDomain } from '../../../domain/ReceitaDomain';
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
  selector: 'app-visao-jogadores',
  standalone: true,
  imports: [CommonModule, FormsModule, SkillTree, ImageModal],
  templateUrl: './visao-jogadores.html',
  styleUrls: ['./visao-jogadores.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisaoJogadores implements OnInit {
  jogador: (JogadorDomain & { fator_de_cura?: number; deslocamento?: number; vida_atual?: number }) | null = null;
  atributos: any[] = [];
  loading = true;

  // Inventário
  categorias: CategoriaInventario[] = [];
  categoriasFiltradas: CategoriaInventario[] = [];
  carregandoInventario = true;

  // Modal de imagem
  imagemSelecionada: string | null = null;
  modalAberto = false;

  resumo = { tipos: 0, unidades: 0, pesoTotal: 0 };

  // Abas
  abaAtiva: 'jogador' | 'inventario' | 'habilidades' = 'jogador';
  abaInventario: 'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros' = 'tudo';
  abaHabilidade: string = 'Warlord'; // mock inicial
  abasInventario: Array<'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros'> = [
    'tudo', 'recursos', 'equipamentos', 'pocoes', 'outros'
  ];
  abasHabilidades = ['Warlord', 'Arcane', 'Rogue'];
  filtroInventario = '';
  itemSelecionado: InventarioDetalhado | null = null;
  ingredientesDetalhados: { item: CatalogoDomain; quantidade: number }[] = [];
  receitasAssociadas: { produto: CatalogoDomain; quantidade: number }[] = [];
  ehMestre = false;

  private jogadorRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');
  private repoReceitas = new BaseRepositoryV2<ReceitaDomain>('Receitas');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/jogadores']);
      return;
    }

    try {
      await this.definirSeEhMestre();
      await this.loadJogador(id);

      if (this.jogador?.email) {
        await this.loadInventario(this.jogador.email);
      }
    } catch (err) {
      console.error('[VisaoJogadores] Erro:', err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async definirSeEhMestre() {
    const user = AuthService.getUser();
    if (user?.email) {
      const jogadores = await this.jogadorRepo.getLocal();
      const jogadorAtual = jogadores.find((j) => j.email === user.email);
      this.ehMestre = jogadorAtual?.tipo_jogador === 'Mestre';
      this.cdr.markForCheck();
    }
  }

  editarItemInventario(id: string, event?: Event) {
    if (event) event.stopPropagation();
    this.itemSelecionado = null;
    this.router.navigate(['/cadastro-inventario', id]);
  }

  async excluirItemInventario(id: string, event?: Event) {
    if (event) event.stopPropagation();
    const confirmacao = confirm('🗑️ Deseja realmente excluir este item do inventário do jogador?');
    if (!confirmacao) return;
    try {
      await this.inventarioRepo.delete(id);
      alert('✅ Item excluído com sucesso!');
      this.itemSelecionado = null;
      if (this.jogador?.email) {
        await this.loadInventario(this.jogador.email);
      }
    } catch (err) {
      console.error('[VisaoJogadores] Erro ao excluir item do inventário:', err);
      alert('❌ Erro ao excluir item.');
    }
  }

  /** 🔹 Cache first para Jogador */
  private async loadJogador(id: string) {
    const locais = await this.jogadorRepo.getLocal();
    let encontrado = locais.find(j => String(j.id) === String(id));
    if (encontrado) this.setJogador(encontrado);

    // sync em paralelo
    this.jogadorRepo.sync().then(async (updated) => {
      if (updated) {
        const atualizados = await this.jogadorRepo.getLocal();
        const atualizado = atualizados.find(j => String(j.id) === String(id));
        if (atualizado) this.setJogador(atualizado);
      }
    });

    // se vazio local → força fetch online
    if (!encontrado) {
      const online = await this.jogadorRepo.forceFetch();
      const remoto = online.find(j => String(j.id) === String(id));
      if (remoto) this.setJogador(remoto);
    }
    
    this.cdr.markForCheck();
  }

  private setJogador(jogador: JogadorDomain) {
    // Garante números padrão
    jogador.escudo = jogador.escudo ?? 0;
    jogador.pontos_de_sorte = jogador.pontos_de_sorte ?? 0;

    // Vida base e cálculos derivados
    const vidaBase =
      jogador.pontos_de_vida && jogador.pontos_de_vida > 0
        ? jogador.pontos_de_vida
        : (jogador.energia || 0) + (jogador.constituicao || 0);

    const fatorCura = jogador.fator_de_cura || 0;
    const deslocamento = jogador.deslocamento || 0;
    const vidaAtual = vidaBase - (jogador.dano_tomado || 0);

    this.jogador = {
      ...jogador,
      pontos_de_vida: vidaBase,
      vida_atual: vidaAtual,
      fator_de_cura: fatorCura,
      deslocamento,
    };

    // Cálculo dos modificadores
    const calcMod = (valor: number) => Math.floor(((valor || 0) - 10) / 2);

    // Lista de atributos visuais
    this.atributos = [
      { label: 'Força', value: jogador.forca, mod: calcMod(jogador.forca), icon: '💪' },
      { label: 'Destreza', value: jogador.destreza, mod: calcMod(jogador.destreza), icon: '🤸‍♂️' },
      { label: 'Constituição', value: jogador.constituicao, mod: calcMod(jogador.constituicao), icon: '🪨' },
      { label: 'Inteligência', value: jogador.inteligencia, mod: calcMod(jogador.inteligencia), icon: '🧠' },
      { label: 'Sabedoria', value: jogador.sabedoria, mod: calcMod(jogador.sabedoria), icon: '📖' },
      { label: 'Carisma', value: jogador.carisma, mod: calcMod(jogador.carisma), icon: '😎' },
      { label: 'Energia', value: jogador.energia, mod: calcMod(jogador.energia), icon: '⚡' },
    ];
    this.cdr.markForCheck();
  }


  /** 🔹 Cache first para Inventário */
  private async loadInventario(email: string) {
    this.carregandoInventario = true;
    try {
      const [catalogoLocal, inventarioLocal] = await Promise.all([
        this.catalogoRepo.getLocal(),
        this.inventarioRepo.getLocal(),
      ]);
      const meusItensLocal = inventarioLocal.filter(i => i.jogador === email);
      this.processarInventario(meusItensLocal, catalogoLocal);

      // sync em paralelo
      Promise.all([this.catalogoRepo.sync(), this.inventarioRepo.sync()]).then(async ([catSync, invSync]) => {
        if (catSync || invSync) {
          const [catalogoAtual, inventarioAtual] = await Promise.all([
            this.catalogoRepo.getLocal(),
            this.inventarioRepo.getLocal(),
          ]);
          const meusItensAtual = inventarioAtual.filter(i => i.jogador === email);
          this.processarInventario(meusItensAtual, catalogoAtual);
        }
      });

      // se vazio local → força fetch online
      if (meusItensLocal.length === 0) {
        const [catalogoOnline, inventarioOnline] = await Promise.all([
          this.catalogoRepo.forceFetch(),
          this.inventarioRepo.forceFetch(),
        ]);
        const meusItensOnline = inventarioOnline.filter(i => i.jogador === email);
        this.processarInventario(meusItensOnline, catalogoOnline);
      }
    } finally {
      this.carregandoInventario = false;
      this.cdr.markForCheck();
    }
  }

  private processarInventario(inventario: InventarioDomain[], catalogo: CatalogoDomain[]) {
    const inventarioDetalhado: InventarioDetalhado[] = inventario.map(inv => {
      const detalhe = catalogo.find(c => String(c.id) === String(inv.item_catalogo));
      return { ...inv, itemDetalhe: detalhe };
    });

    const mapa = new Map<string, InventarioDetalhado[]>();
    inventarioDetalhado.forEach(i => {
      const cat = i.itemDetalhe?.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries()).map(([nome, itens]) => ({
      nome,
      itens,
      expandido: false,
    }));
    this.categoriasFiltradas = [...this.categorias];
    this.calcularResumo();
    this.cdr.markForCheck();
  }

  private calcularResumo() {
    const todosItens = this.categorias.flatMap(c => c.itens);
    this.resumo.tipos = todosItens.length;
    this.resumo.unidades = todosItens.reduce((sum, i) => sum + (i.quantidade || 0), 0);
    this.resumo.pesoTotal = todosItens.reduce(
      (sum, i) => sum + (i.quantidade || 0) * (i.itemDetalhe?.peso || 0),
      0
    );
  }

  selecionarAba(aba: 'jogador' | 'inventario' | 'habilidades') {
    this.abaAtiva = aba;
    this.cdr.markForCheck();
  }

  selecionarAbaInventario(aba: 'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros') {
    this.abaInventario = aba;
    this.cdr.markForCheck();
  }

  selecionarAbaHabilidade(aba: string) {
    this.abaHabilidade = aba;
    this.cdr.markForCheck();
  }

  pertenceAbaInventario(categoria?: string): boolean {
    if (this.abaInventario === 'tudo') return true;
    if (!categoria) return this.abaInventario === 'outros';
    const mapa: Record<string, string[]> = {
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
    return mapa[this.abaInventario]?.includes(categoria) || false;
  }

  getQuantidadePorAbaInventario(aba: 'tudo' | 'recursos' | 'equipamentos' | 'pocoes' | 'outros'): number {
    if (aba === 'tudo') {
      let count = 0;
      this.categorias.forEach(cat => count += cat.itens.length);
      return count;
    }
    const mapa: Record<string, string[]> = {
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
    const categoriasAba = mapa[aba];
    let count = 0;
    this.categorias.forEach(cat => {
      if (categoriasAba?.includes(cat.nome)) count += cat.itens.length;
    });
    return count;
  }

  aplicarFiltroInventario() {
    const termo = this.normalizarTexto(this.filtroInventario);
    if (termo) {
      this.abaInventario = 'tudo'; // Força aba TUDO na pesquisa
    }
    if (!termo) {
      this.categoriasFiltradas = [...this.categorias];
      this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  private normalizarTexto(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  async abrirItemInventario(inv: InventarioDetalhado) {
    this.itemSelecionado = inv;
    this.cdr.markForCheck();
    if (inv.itemDetalhe) {
      await this.carregarReceitas(String(inv.itemDetalhe.id));
    }
  }

  async abrirItemPorCatalogoId(catalogoId: string) {
    try {
      const catalogo = await this.catalogoRepo.getLocal();
      const item = catalogo.find(c => String(c.id) === String(catalogoId));
      if (item) {
        await this.abrirItemInventario({
          id: '',
          jogador: '',
          item_catalogo: item.id,
          quantidade: 0,
          index: 0,
          itemDetalhe: item
        });
      }
    } catch (err) {
      console.error('[VisaoJogadores] Erro ao abrir item por ID do catalogo:', err);
    }
  }

  private async carregarReceitas(itemId: string) {
    this.ingredientesDetalhados = [];
    this.receitasAssociadas = [];
    try {
      const [receitas, catalogo] = await Promise.all([
        this.repoReceitas.getLocal(),
        this.catalogoRepo.getLocal()
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
      console.error('[VisaoJogadores] Erro ao carregar receitas:', err);
    }
  }

  abrirCatalogo(catalogoId: string, event?: Event) {
    if (event) event.stopPropagation();
    this.router.navigate(['/item-catalogo', catalogoId]);
  }

  toggleCategoria(cat: CategoriaInventario) {
    cat.expandido = !cat.expandido;
    this.cdr.markForCheck();
  }

  voltar() {
    this.location.back(); // 🔙 volta para a página anterior no histórico
  }

  abrirImagem(src: string | undefined) {
    if (!src || src === '-') return;
    this.imagemSelecionada = src;
    this.modalAberto = true;
    this.cdr.markForCheck();
  }

  getRaridadeClass(raridade?: string): string {
    if (!raridade) return 'comum';
    return raridade.toLowerCase();
  }
}
