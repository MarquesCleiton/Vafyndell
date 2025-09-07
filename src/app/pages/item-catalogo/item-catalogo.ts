import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { Location } from '@angular/common';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/catalogo']);
      return;
    }

    try {
      this.carregando = true;
      await CatalogoRepository.syncItens();
      const itens = await CatalogoRepository.getLocalItens();
      this.item = itens.find(i => String(i.id) === String(id)) || null;

      if (!this.item) {
        console.warn('[ItemCatalogo] Item não encontrado');
        this.router.navigate(['/catalogo']);
      }
    } catch (err) {
      console.error('[ItemCatalogo] Erro ao carregar item:', err);
    } finally {
      this.carregando = false;
    }
  }

  cancelar() {
    this.location.back();
  }

  editarItem() {
    if (!this.item) return;
    this.processandoEditar = true;

    // Simples loading até redirecionar
    setTimeout(() => {
      this.router.navigate(['/cadastro-item-catalogo', this.item!.id], {
        queryParams: { returnUrl: this.router.url },
      });
      this.processandoEditar = false;
    }, 300);
  }

  excluirItem() {
    if (!this.item) return;

    const confirmacao = confirm(`🗑️ Deseja realmente excluir o item "${this.item.nome}"?`);
    if (!confirmacao) return;

    this.processandoExcluir = true;

    CatalogoRepository.deleteItem(this.item.id)
      .then(() => {
        alert('✅ Item excluído com sucesso!');
        this.router.navigate(['/catalogo']);
      })
      .catch(err => {
        console.error('[ItemCatalogo] Erro ao excluir item:', err);
        alert('❌ Erro ao excluir item. Veja o console.');
      })
      .finally(() => {
        this.processandoExcluir = false;
      });
  }
}
