import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { CatalogoDomain } from '../../domain/CatalogoDomain';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router
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

  editarItem() {
    alert('✏️ Função editar será implementada');
  }

  excluirItem() {
    alert('🗑️ Função excluir será implementada');
  }
}
