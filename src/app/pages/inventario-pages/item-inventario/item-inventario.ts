import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { InventarioDomain } from '../../../domain/InventarioDomain';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';
import { AuthService } from '../../../core/auth/AuthService';

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

  // ✅ Reuso do BaseRepository
  private inventarioRepo = new BaseRepository<InventarioDomain>('Inventario', 'Inventario');
  private catalogoRepo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    try {
      console.log('[ItemInventario] Iniciando carregamento...');
      this.carregando = true;

      const id = this.route.snapshot.paramMap.get('id');
      if (!id) throw new Error('ID inválido para item do inventário');

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // 1️⃣ Cache first
      const [catalogoLocal, inventarioLocal] = await Promise.all([
        this.catalogoRepo.getLocal(),
        this.inventarioRepo.getLocal(),
      ]);

      const encontrado = inventarioLocal.find(
        (i) => String(i.id) === id && i.jogador === user.email
      );
      if (encontrado) {
        this.item = this.montarDetalhe(encontrado, catalogoLocal);
        this.carregando = false;
      }

      // 2️⃣ Sync paralelo
      Promise.all([this.catalogoRepo.sync(), this.inventarioRepo.sync()]).then(
        async ([catSync, invSync]) => {
          if (catSync || invSync) {
            console.log('[ItemInventario] Sync trouxe alterações.');
            const [catalogoAtualizado, inventarioAtualizado] = await Promise.all([
              this.catalogoRepo.getLocal(),
              this.inventarioRepo.getLocal(),
            ]);
            const atualizado = inventarioAtualizado.find(
              (i) => String(i.id) === id && i.jogador === user.email
            );
            if (atualizado) {
              this.item = this.montarDetalhe(atualizado, catalogoAtualizado);
            }
          }
        }
      );

      // 3️⃣ Fallback online
      if (!encontrado) {
        console.log('[ItemInventario] Item não encontrado localmente. Forçando fetch online...');
        await this.catalogoRepo.forceFetch();
        await this.inventarioRepo.forceFetch();

        const [catalogoOnline, inventarioOnline] = await Promise.all([
          this.catalogoRepo.getLocal(),
          this.inventarioRepo.getLocal(),
        ]);

        const achadoOnline = inventarioOnline.find(
          (i) => String(i.id) === id && i.jogador === user.email
        );
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

  /** 🔧 Monta detalhe juntando catálogo */
  private montarDetalhe(
    inventario: InventarioDomain,
    catalogo: CatalogoDomain[]
  ): ItemInventarioDetalhe {
    const detalhe = catalogo.find((c) => String(c.id) === String(inventario.item_catalogo));
    return { inventario, catalogo: detalhe };
  }

  cancelar() {
    this.location.back();
  }

  editarItem() {
    if (!this.item) return;
    this.processandoEditar = true;
    setTimeout(() => {
      this.router.navigate(['/cadastro-inventario', this.item!.inventario.id]);
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
      await this.inventarioRepo.delete(this.item.inventario.index);
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
