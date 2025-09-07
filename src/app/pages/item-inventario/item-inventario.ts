import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InventarioRepository } from '../../repositories/InventarioRepository';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { InventarioDomain } from '../../domain/InventarioDomain';
import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { Location } from '@angular/common';
import { AuthService } from '../../core/auth/AuthService';

interface ItemInventarioDetalhe {
  inventario: InventarioDomain;
  catalogo?: CatalogoDomain;
}

@Component({
  selector: 'app-item-inventario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './item-inventario.html',
  styleUrls: ['./item-inventario.css'],
})
export class ItemInventario implements OnInit {
  item: ItemInventarioDetalhe | null = null;
  carregando = true;
  processandoEditar = false;
  processandoExcluir = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    try {
      console.log('[ItemInventario] Iniciando carregamento...');
      this.carregando = true;

      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!id) throw new Error('ID inválido para item do inventário');

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // 1. Carrega primeiro do cache local
      const inventarioLocal = await InventarioRepository.getLocalInventarioByJogador(user.email);
      const catalogoLocal = await CatalogoRepository.getLocalItens();

      let encontrado = inventarioLocal.find(i => i.id === id);
      let detalhe = encontrado ? catalogoLocal.find(c => c.id === encontrado.item_catalogo) : undefined;

      if (encontrado) {
        this.item = { inventario: encontrado, catalogo: detalhe };
        this.carregando = false; // libera a UI rápido
      }

      // 2. Em paralelo, sincroniza e reprocessa se houver update
      Promise.all([
        InventarioRepository.syncInventario(),
        CatalogoRepository.syncItens(),
      ]).then(async ([invSync, catSync]) => {
        if (invSync || catSync) {
          console.log('[ItemInventario] Sync trouxe alterações. Atualizando cache...');
          const inventarioAtualizado = await InventarioRepository.getLocalInventarioByJogador(user.email);
          const catalogoAtualizado = await CatalogoRepository.getLocalItens();

          const atualizado = inventarioAtualizado.find(i => i.id === id);
          const detalheAtualizado = atualizado ? catalogoAtualizado.find(c => c.id === atualizado.item_catalogo) : undefined;

          if (atualizado) {
            this.item = { inventario: atualizado, catalogo: detalheAtualizado };
          }
        } else {
          console.log('[ItemInventario] Sync concluído. Nenhuma alteração detectada.');
        }
      });

      // 3. Se não encontrou local, tenta buscar online (force fetch)
      if (!encontrado) {
        console.log('[ItemInventario] Item não encontrado localmente. Buscando online...');
        const inventarioOnline = await InventarioRepository.forceFetchInventario();
        const catalogoOnline = await CatalogoRepository.getLocalItens();

        const achadoOnline = inventarioOnline.find(i => i.id === id);
        const detalheOnline = achadoOnline ? catalogoOnline.find(c => c.id === achadoOnline.item_catalogo) : undefined;

        if (achadoOnline) {
          this.item = { inventario: achadoOnline, catalogo: detalheOnline };
        } else {
          throw new Error('Item não encontrado nem online.');
        }

        this.carregando = false;
      }
    } catch (err) {
      console.error('[ItemInventario] Erro ao carregar item:', err);
      this.carregando = false;
    }
  }

  cancelar() {
    this.location.back();
  }

  editarItem() {
    if (!this.item) return;
    this.processandoEditar = true;

    setTimeout(() => {
      this.router.navigate(['/cadastro-inventario', this.item!.inventario.id], {
        queryParams: { returnUrl: this.router.url },
      });
      this.processandoEditar = false;
    }, 500);
  }

  async excluirItem() {
    if (!this.item) return;
    const confirmacao = confirm(`🗑️ Deseja remover "${this.item.catalogo?.nome}" do inventário?`);
    if (!confirmacao) return;

    this.processandoExcluir = true;
    try {
      await InventarioRepository.deleteInventario(this.item.inventario.id);
      alert('✅ Item removido do inventário!');
      this.router.navigate(['/inventario-jogador']);
    } catch (err) {
      console.error('[ItemInventario] Erro ao excluir item:', err);
      alert('❌ Erro ao excluir item. Veja o console.');
    } finally {
      this.processandoExcluir = false;
    }
  }
}
