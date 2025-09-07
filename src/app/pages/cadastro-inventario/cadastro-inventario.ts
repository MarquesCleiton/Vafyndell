import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// Domínios e Repositórios
import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { InventarioDomain } from '../../domain/InventarioDomain';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { InventarioRepository } from '../../repositories/InventarioRepository';
import { AuthService } from '../../core/auth/AuthService';

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
  returnUrl: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    try {
      console.log('[CadastroInventario] Iniciando carregamento...');

      // 1. Carrega catálogo local primeiro
      this.catalogoItens = await CatalogoRepository.getLocalItens();
      this.catalogoFiltrado = this.catalogoItens;

      // 2. Em paralelo, sincroniza catálogo
      CatalogoRepository.syncItens().then(async updated => {
        if (updated) {
          console.log('[CadastroInventario] Catálogo atualizado. Recarregando...');
          this.catalogoItens = await CatalogoRepository.getLocalItens();
          this.catalogoFiltrado = this.catalogoItens;
        }
      });

      // 🔑 pega returnUrl da query string
      this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

      // 3. Verifica se está em modo edição
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (id) {
        this.editando = true;

        const user = AuthService.getUser();
        if (!user?.email) throw new Error('Usuário não autenticado.');

        // Busca local primeiro
        const inventarioLocal = await InventarioRepository.getLocalInventarioByJogador(user.email);
        this.inventarioAtual = inventarioLocal.find(i => i.id === id) || null;

        if (this.inventarioAtual) {
          this.selecionado = this.catalogoItens.find(c => c.id === this.inventarioAtual!.item_catalogo) || null;
          this.quantidade = this.inventarioAtual.quantidade;
          this.filtro = this.selecionado?.nome || '';
        }

        // Em paralelo, sincroniza inventário
        InventarioRepository.syncInventario().then(async updated => {
          if (updated) {
            console.log('[CadastroInventario] Inventário atualizado. Recarregando item...');
            const atualizado = await InventarioRepository.getLocalInventarioByJogador(user.email);
            const inventarioRecarregado = atualizado.find(i => i.id === id);
            if (inventarioRecarregado) {
              this.inventarioAtual = inventarioRecarregado;
              this.selecionado = this.catalogoItens.find(c => c.id === inventarioRecarregado.item_catalogo) || null;
              this.quantidade = inventarioRecarregado.quantidade;
              this.filtro = this.selecionado?.nome || '';
            }
          }
        });

        // Se não encontrou local, força buscar online
        if (!this.inventarioAtual) {
          const inventarioOnline = await InventarioRepository.forceFetchInventario();
          this.inventarioAtual = inventarioOnline.find(i => i.id === id) || null;
          if (this.inventarioAtual) {
            this.selecionado = this.catalogoItens.find(c => c.id === this.inventarioAtual!.item_catalogo) || null;
            this.quantidade = this.inventarioAtual.quantidade;
            this.filtro = this.selecionado?.nome || '';
          }
        }
      }
    } catch (err) {
      console.error('[CadastroInventario] Erro ao carregar:', err);
    }
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

    this.catalogoFiltrado = this.catalogoItens.filter(c =>
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
    this.router.navigate([this.returnUrl || '/inventario-jogador']);
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo'], {
      queryParams: { returnUrl: '/cadastro-inventario' },
    });
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
        await InventarioRepository.updateInventario(atualizado);
      } else {
        const todos = await InventarioRepository.getLocalInventarioByJogador(user.email);
        const maxIndex = todos.length > 0 ? Math.max(...todos.map(i => i.index || 0)) : 0;

        const novo: InventarioDomain = {
          id: maxIndex + 1,
          index: maxIndex + 1,
          jogador: user.email,
          item_catalogo: this.selecionado.id,
          quantidade: this.quantidade,
        };
        await InventarioRepository.createInventario(novo);
      }

      alert('✅ Item salvo no inventário!');
      this.router.navigate([this.returnUrl || '/inventario-jogador']);
    } catch (err) {
      console.error('[CadastroInventario] Erro ao salvar:', err);
      alert('❌ Erro ao salvar item. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }
}
