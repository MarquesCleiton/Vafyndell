import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';

import { InventarioRepository } from '../../repositories/InventarioRepository';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { InventarioDomain } from '../../domain/InventarioDomain';
import { CatalogoDomain } from '../../domain/CatalogoDomain';
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

      const idParam = this.route.snapshot.paramMap.get('id');
      const id = idParam ? Number(idParam) : NaN;
      if (isNaN(id)) throw new Error('ID inválido para item do inventário');

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // 1️⃣ Cache first → garante catálogo e inventário locais
      const catalogoLocal = await CatalogoRepository.getLocalItens();
      const inventarioLocal = await InventarioRepository.getLocalInventarioByJogador(user.email);

      const encontrado = inventarioLocal.find(i => i.id === id);
      if (encontrado) {
        this.item = this.montarDetalhe(encontrado, catalogoLocal);
        this.carregando = false; // libera a UI rápido
      }

      // 2️⃣ Sync paralelo (catálogo + inventário)
      Promise.all([
        CatalogoRepository.syncItens(),
        InventarioRepository.syncInventario(),
      ]).then(async ([catSync, invSync]) => {
        if (catSync || invSync) {
          console.log('[ItemInventario] Sync trouxe alterações. Atualizando cache...');
          const catalogoAtualizado = await CatalogoRepository.getLocalItens();
          const inventarioAtualizado = await InventarioRepository.getLocalInventarioByJogador(user.email);
          const atualizado = inventarioAtualizado.find(i => i.id === id);
          if (atualizado) {
            this.item = this.montarDetalhe(atualizado, catalogoAtualizado);
          }
        } else {
          console.log('[ItemInventario] Sync concluído. Nenhuma alteração detectada.');
        }
      });

      // 3️⃣ Fallback → se não encontrou local, força buscar online
      if (!encontrado) {
        console.log('[ItemInventario] Item não encontrado localmente. Forçando fetch online...');
        const catalogoOnline = await CatalogoRepository.forceFetchItens();
        const inventarioOnline = await InventarioRepository.forceFetchInventario();

        const achadoOnline = inventarioOnline.find(i => i.id === id);
        if (achadoOnline) {
          this.item = this.montarDetalhe(achadoOnline, catalogoOnline);
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

  /** 🔧 Helper para montar detalhe com catálogo */
  private montarDetalhe(
    inventario: InventarioDomain,
    catalogo: CatalogoDomain[]
  ): ItemInventarioDetalhe {
    const detalhe = catalogo.find(c => c.id === inventario.item_catalogo);
    return { inventario, catalogo: detalhe };
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
    }, 400);
  }

  async excluirItem() {
    if (!this.item) return;
    const confirmacao = confirm(
      `🗑️ Deseja remover "${this.item.catalogo?.nome}" do inventário?`
    );
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
