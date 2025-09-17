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
import { BaseRepository } from '../../../repositories/BaseRepository';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';

@Component({
  selector: 'app-cadastro-inventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // Angular Material
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

  // ✅ Repositories genéricos
  private catalogoRepo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');
  private inventarioRepo = new BaseRepository<InventarioDomain>('Inventario', 'Inventario');

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) { }

  async ngOnInit() {
    try {
      console.log('[CadastroInventario] Iniciando carregamento...');

      // 1️⃣ Catálogo local primeiro
      this.catalogoItens = await this.catalogoRepo.getLocal();
      this.catalogoFiltrado = this.catalogoItens;

      // 2️⃣ Sync catálogo em paralelo
      this.catalogoRepo.sync().then(async (updated) => {
        if (updated) {
          console.log('[CadastroInventario] Catálogo atualizado. Recarregando...');
          this.catalogoItens = await this.catalogoRepo.getLocal();
          this.catalogoFiltrado = this.catalogoItens;
        }
      });

      // 3️⃣ Verifica edição
      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        this.editando = true;

        const user = AuthService.getUser();
        if (!user?.email) throw new Error('Usuário não autenticado.');

        // Inventário local do jogador
        const inventarioLocal = await this.inventarioRepo.getLocal();
        this.inventarioAtual = inventarioLocal.find(
          (i) => String(i.id) === idParam && i.jogador === user.email
        ) || null;

        if (this.inventarioAtual) {
          await this.carregarItemSelecionado(this.inventarioAtual);
        }

        // Sync inventário em paralelo
        this.inventarioRepo.sync().then(async (updated) => {
          if (updated) {
            console.log('[CadastroInventario] Inventário atualizado. Recarregando item...');
            const atualizado = await this.inventarioRepo.getLocal();
            const inventarioRecarregado = atualizado.find(
              (i) => String(i.id) === idParam && i.jogador === user.email
            );
            if (inventarioRecarregado) {
              this.inventarioAtual = inventarioRecarregado;
              await this.carregarItemSelecionado(this.inventarioAtual);
            }
          }
        });

        // Fallback: força fetch se não tinha nada
        if (!this.inventarioAtual) {
          const inventarioOnline = await this.inventarioRepo.forceFetch();
          this.inventarioAtual = inventarioOnline.find(
            (i) => String(i.id) === idParam && i.jogador === user.email
          ) || null;

          if (this.inventarioAtual) {
            await this.carregarItemSelecionado(this.inventarioAtual);
          }
        }
      }
    } catch (err) {
      console.error('[CadastroInventario] Erro ao carregar:', err);
    }
  }

  private async carregarItemSelecionado(inventario: InventarioDomain) {
    if (!this.catalogoItens.length) {
      this.catalogoItens = await this.catalogoRepo.getLocal();
      this.catalogoFiltrado = this.catalogoItens;
    }

    this.selecionado = this.catalogoItens.find((c) => String(c.id) === String(inventario.item_catalogo)) || null;
    this.quantidade = inventario.quantidade;
    this.filtro = this.selecionado?.nome || '';
  }

  filtrarItens() {
    const normalizar = (texto: string) =>
      (texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const termo = normalizar(this.filtro || '');
    if (!termo) {
      this.catalogoFiltrado = [...this.catalogoItens];
      return;
    }

    this.catalogoFiltrado = this.catalogoItens.filter((c) =>
      normalizar(c.nome).includes(termo)
    );
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
      // Se está editando, volta para a página de detalhes do item
      this.router.navigate(['/item-inventario', this.inventarioAtual.id]);
    } else {
      // Se não está editando, volta para a lista geral
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
        // 🚀 edição normal → sobrescreve quantidade
        const atualizado: InventarioDomain = {
          ...this.inventarioAtual,
          jogador: user.email,
          item_catalogo: this.selecionado.id,
          quantidade: this.quantidade,
        };
        await this.inventarioRepo.update(atualizado);
      } else {
        // 🚀 criação → mas precisa checar se já existe no inventário do jogador
        const todos = await this.inventarioRepo.getLocal();
        
        const existente: InventarioDomain | undefined = todos.find(
          (i: InventarioDomain) =>
            i.jogador === user.email &&
            String(i.item_catalogo) === String(this.selecionado!.id)
        );


        if (existente) {
          // ✅ já existe → soma quantidades
          const atualizado: InventarioDomain = {
            ...existente,
            quantidade: (existente.quantidade || 0) + this.quantidade,
          };
          await this.inventarioRepo.update(atualizado);
        } else {
          // ✅ não existe → cria novo
          const maxIndex = todos.length > 0 ? Math.max(...todos.map((i) => i.index || 0)) : 0;
          const novo: InventarioDomain = {
            id: IdUtils.generateULID(),
            index: maxIndex + 1,
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
      console.error('[CadastroInventario] Erro ao salvar:', err);
      alert('❌ Erro ao salvar item. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }



  displayFn(item?: CatalogoDomain): string {
    return item ? item.nome : '';
  }

}
