import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { InventarioDomain } from '../../../domain/InventarioDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';

@Component({
  selector: 'app-cadastro-inventario',
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
  templateUrl: './cadastro-inventario.html',
  styleUrls: ['./cadastro-inventario.css'],
})
export class CadastroInventario implements OnInit {
  catalogoItens: CatalogoDomain[] = [];
  catalogoFiltrado: CatalogoDomain[] = [];
  selecionado: CatalogoDomain | null = null;
  filtro = '';
  quantidade = 1;
  salvando = false;
  editando = false;
  inventarioAtual: InventarioDomain | null = null;

  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    try {
      console.log('[CadastroInventario] ▶️ Iniciando carregamento...');

      // 1️⃣ Catálogo local primeiro
      this.catalogoItens = await this.catalogoRepo.getLocal();
      this.catalogoFiltrado = this.catalogoItens;

      // 2️⃣ Sync catálogo em paralelo
      this.catalogoRepo.sync().then(async (updated) => {
        if (updated) {
          console.log('[CadastroInventario] Catálogo atualizado.');
          this.catalogoItens = await this.catalogoRepo.getLocal();
          this.catalogoFiltrado = this.catalogoItens;
        }
      });

      // 3️⃣ Edição
      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        this.editando = true;

        const user = AuthService.getUser();
        if (!user?.email) throw new Error('Usuário não autenticado.');

        const locais = await this.inventarioRepo.getLocal();
        this.inventarioAtual = locais.find(
          (i) => i.id === idParam && i.jogador === user.email
        ) || null;

        if (this.inventarioAtual) {
          await this.carregarItemSelecionado(this.inventarioAtual);
        }

        // Sync inventário
        this.inventarioRepo.sync().then(async (updated) => {
          if (updated) {
            const atualizados = await this.inventarioRepo.getLocal();
            const recarregado = atualizados.find(
              (i) => i.id === idParam && i.jogador === user.email
            );
            if (recarregado) {
              this.inventarioAtual = recarregado;
              await this.carregarItemSelecionado(this.inventarioAtual);
            }
          }
        });

        // Fallback: força online
        if (!this.inventarioAtual) {
          const online = await this.inventarioRepo.forceFetch();
          this.inventarioAtual = online.find(
            (i) => i.id === idParam && i.jogador === user.email
          ) || null;

          if (this.inventarioAtual) {
            await this.carregarItemSelecionado(this.inventarioAtual);
          }
        }
      }
    } catch (err) {
      console.error('[CadastroInventario] ❌ Erro ao carregar:', err);
    }
  }

  private async carregarItemSelecionado(inventario: InventarioDomain) {
    if (!this.catalogoItens.length) {
      this.catalogoItens = await this.catalogoRepo.getLocal();
      this.catalogoFiltrado = this.catalogoItens;
    }

    this.selecionado = this.catalogoItens.find((c) => c.id === inventario.item_catalogo) || null;
    this.quantidade = inventario.quantidade;
    this.filtro = this.selecionado?.nome || '';
  }

  filtrarItens() {
    const normalizar = (t: string) =>
      (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const termo = normalizar(this.filtro || '');
    this.catalogoFiltrado = termo
      ? this.catalogoItens.filter((c) => normalizar(c.nome).includes(termo))
      : [...this.catalogoItens];
  }

  selecionarItem(item: CatalogoDomain) {
    this.selecionado = item;
    this.filtro = item.nome;
  }

  incrementar() {
    this.quantidade++;
  }

  decrementar() {
    this.quantidade = Math.max(1, this.quantidade - 1);
  }

  cancelar() {
    if (this.editando && this.inventarioAtual?.id) {
      this.router.navigate(['/item-inventario', this.inventarioAtual.id]);
    } else {
      this.router.navigate(['/inventario-jogador']);
    }
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo']);
  }

  async salvar(form: NgForm) {
    if (form.invalid || !this.selecionado) return;

    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');

      if (this.editando && this.inventarioAtual) {
        const atualizado: InventarioDomain = {
          ...this.inventarioAtual,
          jogador: user.email,
          item_catalogo: this.selecionado.id,
          quantidade: this.quantidade,
        };
        await this.inventarioRepo.update(atualizado);
      } else {
        const todos = await this.inventarioRepo.getLocal();

        const existente = todos.find(
          (i) => i.jogador === user.email && i.item_catalogo === this.selecionado!.id
        );

        if (existente) {
          const atualizado: InventarioDomain = {
            ...existente,
            quantidade: (existente.quantidade || 0) + this.quantidade,
          };
          await this.inventarioRepo.update(atualizado);
        } else {
          const novo: InventarioDomain = {
            id: IdUtils.generateULID(),
            index: Date.now(), // 🔑 apenas referência incremental
            jogador: user.email,
            item_catalogo: this.selecionado.id,
            quantidade: this.quantidade,
          };
          await this.inventarioRepo.create(novo);
        }
      }

      alert('✅ Item salvo no inventário!');
      this.router.navigate(['/inventario-jogador']);
    } catch (err) {
      console.error('[CadastroInventario] ❌ Erro ao salvar:', err);
      alert('❌ Erro ao salvar item.');
    } finally {
      this.salvando = false;
    }
  }

  displayFn(item?: CatalogoDomain): string {
    return item ? item.nome : '';
  }
}
