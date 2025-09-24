import { Component, AfterViewInit, ElementRef, OnInit, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { ReceitaDomain } from '../../../domain/ReceitaDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { ImageUtils } from '../../../core/utils/ImageUtils';
import { IdUtils } from '../../../core/utils/IdUtils';
import { AuthService } from '../../../core/auth/AuthService';

@Component({
  selector: 'app-cadastro-item-catalogo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatInputModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './cadastro-item-catalogo.html',
  styleUrls: ['./cadastro-item-catalogo.css'],
})
export class CadastroItemCatalogo implements OnInit, AfterViewInit {
  item: CatalogoDomain = {
    id: '',
    nome: '',
    quantidade_fabricavel: 1,
    unidade_medida: '',
    peso: 0,
    categoria: '',
    origem: '',
    raridade: '',
    efeito: '',
    colateral: '',
    descricao: '',
    imagem: '-',
    visivel_jogadores: true,
    email: '',
  };

  imagemBase64Temp: string | null = null;
  salvando = false;
  editMode = false;

  unidadesMedida = ['g', 'kg', 'ml', 'L', 'mm', 'cm', 'm', 'gota(s)', 'dose(s)', 'frasco(s)', 'unidade(s)'];
  origens = ['Frabricado', 'Natural'];
  raridades = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];
  categorias = [
    'Poção de Cura – Regenera vida, cicatriza feridas',
    'Poção de Cura – Regenera vida, cicatriza feridas',
    'Poção Sensorial – Visão, audição, percepção, voz, respiração',
    'Poção de Aprimoramento Físico – Força, resistência, agilidade',
    'Poção Mental – Calmante, foco, memória, sono, esquecimento',
    'Poção de Energia – Percepção da energia fundamental',
    'Poção de Furtividade – Camuflagem, passos suaves, silêncio',
    'Veneno – Sonolência, confusão ou morte',
    'Utilitário – Bombas, armadilhas, luz, som, gás, adesivos',
    'Recursos botânicos',
    'Componentes bestiais e animalescos',
    'Mineral',
    'Moeda',
    'Tesouro',
    'Equipamento',
    'Ferramentas',
    'Outros'
  ];

  private repoCatalogo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private repoReceitas = new BaseRepositoryV2<ReceitaDomain>('Receitas');

  catalogoItens: CatalogoDomain[] = [];
  ingredientes: any[] = [];
  catalogoFiltradoIng: CatalogoDomain[] = [];
  filtroIngrediente = '';
  ingredienteSelecionado: CatalogoDomain | null = null;
  novoIngrediente = { catalogo: null as string | null, quantidade: 1 };

  constructor(
    private router: Router,
    private el: ElementRef,
    private route: ActivatedRoute,
    private zone: NgZone,
    private location: Location
  ) { }

  // =========================================================
  // 📌 Ciclo de vida
  // =========================================================
  async ngOnInit() {
    this.catalogoItens = await this.repoCatalogo.getLocal();
    this.catalogoFiltradoIng = this.catalogoItens;

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode = true;

      const existente = await this.repoCatalogo.getById(id, true);
      if (existente) this.item = { ...existente };

      const recsLocais = await this.repoReceitas.getLocal();
      this.ingredientes = this.mapIngredientes(recsLocais, id);

      this.repoCatalogo.sync().then(async (updated) => {
        if (updated) {
          this.catalogoItens = await this.repoCatalogo.getLocal();
          const atualizado = await this.repoCatalogo.getById(id, true);
          if (atualizado) this.item = atualizado;
        }
      });

      this.repoReceitas.sync().then(async (updated) => {
        if (updated) {
          const recs = await this.repoReceitas.getLocal();
          this.catalogoItens = await this.repoCatalogo.getLocal();
          this.ingredientes = this.mapIngredientes(recs, id);
        }
      });

      if (!existente) {
        const onlineCatalogo = await this.repoCatalogo.forceFetch();
        this.catalogoItens = onlineCatalogo;
        const achado = onlineCatalogo.find((i) => String(i.id) === id);
        if (achado) this.item = achado;

        const onlineReceitas = await this.repoReceitas.forceFetch();
        this.ingredientes = this.mapIngredientes(onlineReceitas, id);
      }
    }
  }

  ngAfterViewInit() {
    this.scheduleAutoExpand();
  }
  private scheduleAutoExpand() {
    setTimeout(() => this.applyAutoExpand(), 0);
  }
  private applyAutoExpand() {
    const textareas = this.el.nativeElement.querySelectorAll('textarea.auto-expand');
    textareas.forEach((ta: HTMLTextAreaElement) => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
      ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
      });
    });
  }

  // =========================================================
  // 📌 Imagem
  // =========================================================
  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      this.imagemBase64Temp = await ImageUtils.toOptimizedBase64(file, 0.72, 800);
    }
  }
  removerImagem() {
    this.item.imagem = '-';
    this.imagemBase64Temp = null;
  }

  // =========================================================
  // 📌 Ingredientes
  // =========================================================
  private mapIngredientes(recs: any[], fabricavelId: string) {
    return recs
      .filter((r) => String(r.fabricavel) === String(fabricavelId))
      .map((r) => ({
        ...r,
        item: this.catalogoItens.find((c) => String(c.id) === String(r.catalogo)) || null,
      }));
  }

  filtrarCatalogoIngredientes() {
    const termo = (this.filtroIngrediente || '').toLowerCase().trim();
    this.catalogoFiltradoIng = termo
      ? this.catalogoItens.filter((c) => c.nome.toLowerCase().includes(termo))
      : [...this.catalogoItens];
  }

  selecionarIngrediente(item: CatalogoDomain) {
    this.ingredienteSelecionado = item;
    this.novoIngrediente.catalogo = item.id;
    this.filtroIngrediente = item.nome;
  }

  incrementarIngrediente() {
    this.novoIngrediente.quantidade++;
  }
  decrementarIngrediente() {
    this.novoIngrediente.quantidade = Math.max(1, this.novoIngrediente.quantidade - 1);
  }

  adicionarIngrediente() {
    if (!this.ingredienteSelecionado || !this.novoIngrediente.catalogo) return;
    const ing = {
      id: IdUtils.generateULID(),
      fabricavel: String(this.item.id),
      catalogo: String(this.novoIngrediente.catalogo),
      quantidade: this.novoIngrediente.quantidade,
      item: this.ingredienteSelecionado,
    };
    this.ingredientes.push(ing);
    this.ingredienteSelecionado = null;
    this.filtroIngrediente = '';
    this.novoIngrediente = { catalogo: null, quantidade: 1 };
  }

  removerIngrediente(index: number) {
    this.ingredientes.splice(index, 1);
  }

  // =========================================================
  // 📌 Salvar (Catálogo + Receitas em 1 batch)
  // =========================================================
  async salvar(form: NgForm) {
    if (form.invalid) return;
    if (this.ingredientes.length === 0) this.item.quantidade_fabricavel = 1;

    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.item.email = user.email;

      // Garante ID para item novo
      if (!this.editMode && !this.item.id) {
        this.item.id = IdUtils.generateULID();
      }

      // payload do catálogo
      const payloadCatalogo: any = { ...this.item };
      if (this.imagemBase64Temp) payloadCatalogo.imagem = this.imagemBase64Temp;

      // 🔑 Receitas antigas → excluir todas
      const receitasExistentes = await this.repoReceitas.getLocal();
      const antigas = receitasExistentes.filter(r => String(r.fabricavel) === String(this.item.id));
      const deletes = antigas.map(r => ({ id: r.id }));

      // 🔑 Novos ingredientes
      const novos = this.ingredientes.map(ing => ({
        id: IdUtils.generateULID(),
        fabricavel: String(this.item.id),
        catalogo: String(ing.catalogo),
        quantidade: ing.quantidade,
      }));

      // ✅ Tudo em 1 batch
      const result = await BaseRepositoryV2.batch({
        updateById: this.editMode ? { Catalogo: [payloadCatalogo] } : undefined,
        create: !this.editMode ? { Catalogo: [payloadCatalogo], Receitas: novos } : (novos.length ? { Receitas: novos } : undefined),
        deleteById: deletes.length ? { Receitas: deletes } : undefined,
      });

      console.log('[CadastroItemCatalogo] ◀️ batch result', result);

      alert('✅ Item e receitas salvos com sucesso!');
      this.cancelar();
    } catch (err) {
      console.error('[CadastroItemCatalogo] ❌ Erro ao salvar:', err);
      alert('❌ Erro ao salvar');
    } finally {
      this.salvando = false;
      this.imagemBase64Temp = null;
    }
  }


  cancelar() {
    this.location.back();
  }

  getResumo(): string {
    if (!this.ingredientes.length) return '';
    const insumos = this.ingredientes
      .map((i) => `${i.quantidade}x ${i.item?.nome || '???'}`)
      .join(' + ');
    return `${insumos} = ${this.item.quantidade_fabricavel || 1}x ${this.item.nome || 'Item'}`;
  }
}
