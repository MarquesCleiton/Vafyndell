import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';


@Component({
  selector: 'app-item-catalogo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './item-catalogo.html',
  styleUrls: ['./item-catalogo.css'],
})
export class ItemCatalogo implements OnInit {
  item: CatalogoDomain | null = null;
  carregando = true;

  processandoEditar = false;
  processandoExcluir = false;

  // ✅ Reuso do BaseRepository
  private repo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    try {
      console.log('[ItemCatalogo] Iniciando carregamento...');
      this.carregando = true;

      const id = this.route.snapshot.paramMap.get('id');
      if (!id) {
        this.router.navigate(['/catalogo']);
        return;
      }

      // 1️⃣ Carrega cache local
      const locais = await this.repo.getLocal();
      let encontrado = locais.find((i) => String(i.id) === id) || null;

      if (encontrado) {
        this.item = encontrado;
        this.carregando = false; // libera UI rápido
      }

      // 2️⃣ Sincroniza em paralelo
      this.repo.sync().then(async (updated) => {
        if (updated) {
          console.log('[ItemCatalogo] Sync trouxe alterações. Recarregando...');
          const atualizados = await this.repo.getLocal();
          const atualizado = atualizados.find((i) => String(i.id) === id);
          if (atualizado) this.item = atualizado;
        }
      });

      // 3️⃣ Fallback se não achou local
      if (!encontrado) {
        console.log('[ItemCatalogo] Não encontrado localmente → forçando fetch online');
        const online = await this.repo.forceFetch();
        const achadoOnline = online.find((i) => String(i.id) === id);
        if (achadoOnline) {
          this.item = achadoOnline;
        } else {
          console.warn('[ItemCatalogo] Item não encontrado nem online');
          this.router.navigate(['/catalogo']);
        }
        this.carregando = false;
      }
    } catch (err) {
      console.error('[ItemCatalogo] Erro ao carregar item:', err);
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
      this.router.navigate(['/cadastro-item-catalogo', this.item!.id], {
        queryParams: { returnUrl: this.router.url },
      });
      this.processandoEditar = false;
    }, 300);
  }

  async excluirItem() {
    if (!this.item) return;

    const confirmacao = confirm(`🗑️ Deseja excluir o item "${this.item.nome}"?`);
    if (!confirmacao) return;

    this.processandoExcluir = true;
    try {
      await this.repo.delete(String(this.item.id));
      alert('✅ Item excluído com sucesso!');
      this.router.navigate(['/catalogo']);
    } catch (err) {
      console.error('[ItemCatalogo] Erro ao excluir item:', err);
      alert('❌ Erro ao excluir item. Veja o console.');
    } finally {
      this.processandoExcluir = false;
    }
  }
}
