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
import { BaseRepository } from '../../../repositories/BaseRepository';
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
    index: 0,
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

  unidadesMedida = ['g', 'kg', 'ml', 'l', 'cm', 'm', 'unidade'];
  origens = ['Fabricável', 'Natural'];
  raridades = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];
  categorias = ['Recursos botânicos', 'Mineral', 'Equipamento', 'Moeda', 'Tesouro', 'Outros'];

  private repoCatalogo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');
  private repoReceitas = new BaseRepository<any>('Receitas', 'Receitas');

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

      const existente = this.catalogoItens.find(i => String(i.id) === id);
      if (existente) this.item = { ...existente };

      const recsLocais = await this.repoReceitas.getLocal();
      this.ingredientes = this.mapIngredientes(recsLocais, id);

      this.repoCatalogo.sync().then(async (updated) => {
        if (updated) {
          this.catalogoItens = await this.repoCatalogo.getLocal();
          const atualizado = this.catalogoItens.find(i => String(i.id) === id);
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
        const achado = onlineCatalogo.find(i => String(i.id) === id);
        if (achado) this.item = achado;

        const onlineReceitas = await this.repoReceitas.forceFetch();
        this.ingredientes = this.mapIngredientes(onlineReceitas, id);
      }
    }
  }

  ngAfterViewInit() { this.scheduleAutoExpand(); }
  private scheduleAutoExpand() { setTimeout(() => this.applyAutoExpand(), 0); }
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
  removerImagem() { this.item.imagem = '-'; this.imagemBase64Temp = null; }

  // =========================================================
  // 📌 Ingredientes
  // =========================================================
  private mapIngredientes(recs: any[], fabricavelId: string) {
    return recs
      .filter(r => String(r.fabricavel) === String(fabricavelId))
      .map(r => ({
        ...r,
        item: this.catalogoItens.find(c => String(c.id) === String(r.catalogo)) || null,
      }));
  }

  filtrarCatalogoIngredientes() {
    const termo = (this.filtroIngrediente || '').toLowerCase().trim();
    this.catalogoFiltradoIng = termo
      ? this.catalogoItens.filter(c => c.nome.toLowerCase().includes(termo))
      : [...this.catalogoItens];
  }

  selecionarIngrediente(item: CatalogoDomain) {
    this.ingredienteSelecionado = item;
    this.novoIngrediente.catalogo = item.id;
    this.filtroIngrediente = item.nome;
  }

  incrementarIngrediente() { this.novoIngrediente.quantidade++; }
  decrementarIngrediente() { this.novoIngrediente.quantidade = Math.max(1, this.novoIngrediente.quantidade - 1); }

  adicionarIngrediente() {
    if (!this.ingredienteSelecionado || !this.novoIngrediente.catalogo) return;
    const ing = {
      id: IdUtils.generateULID(),
      index: Date.now(),
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

  removerIngrediente(index: number) { this.ingredientes.splice(index, 1); }

  // =========================================================
  // 📌 Salvar
  // =========================================================
  async salvar(form: NgForm) {
    if (form.invalid) return;
    if (this.ingredientes.length === 0) this.item.quantidade_fabricavel = 1;

    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.item.email = user.email;

      let itemSalvo: CatalogoDomain;

      if (this.editMode) {
        const payload: any = { ...this.item };
        if (this.imagemBase64Temp) payload.imagem = this.imagemBase64Temp;
        const [updated] = await this.repoCatalogo.updateBatch([payload]);
        itemSalvo = updated;
      } else {
        const locais = await this.repoCatalogo.getLocal();
        const maxIndex = locais.length > 0 ? Math.max(...locais.map(i => i.index || 0)) : 0;

        this.item.id = IdUtils.generateULID();
        this.item.index = maxIndex + 1;
        const payload: any = { ...this.item };
        if (this.imagemBase64Temp) payload.imagem = this.imagemBase64Temp;
        const [created] = await this.repoCatalogo.createBatch([payload]);
        itemSalvo = created;
      }

      // 🔑 Receitas
      const receitasExistentes = await this.repoReceitas.getLocal();
      const antigas = receitasExistentes.filter(
        r => String(r.fabricavel) === String(itemSalvo.id)
      );
      const deletes = antigas.map(r => r.index);

      console.log('[CadastroItemCatalogo] Receitas antigas →', antigas);
      console.log('[CadastroItemCatalogo] Index para apagar →', deletes);

      const novos = this.ingredientes.map((ing, i) => ({
        id: IdUtils.generateULID(),
        index: Date.now() + i,
        fabricavel: String(itemSalvo.id),
        catalogo: String(ing.catalogo),
        quantidade: ing.quantidade,
      }));

      if (deletes.length > 0) {
        await this.repoReceitas.deleteBatch(deletes as any);
        console.log('[CadastroItemCatalogo] ✅ Receitas antigas apagadas');
      }
      if (novos.length > 0) {
        await this.repoReceitas.createBatch(novos);
        console.log('[CadastroItemCatalogo] ✅ Novas receitas criadas', novos);
      }

      alert('✅ Item e receita salvos com sucesso!');
      this.cancelar();
    } catch (err) {
      console.error('[CadastroItemCatalogo] Erro ao salvar:', err);
      alert('❌ Erro ao salvar');
    } finally {
      this.salvando = false;
      this.imagemBase64Temp = null;
    }
  }

  cancelar() { this.location.back(); }

  getResumo(): string {
    if (!this.ingredientes.length) return '';
    const insumos = this.ingredientes
      .map(i => `${i.quantidade}x ${i.item?.nome || '???'}`)
      .join(' + ');
    return `${insumos} = ${this.item.quantidade_fabricavel || 1}x ${this.item.nome || 'Item'}`;
  }
}
