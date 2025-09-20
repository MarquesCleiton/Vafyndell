import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { ReceitaDomain } from '../../../domain/ReceitaDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';

@Component({
  selector: 'app-item-catalogo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './item-catalogo.html',
  styleUrls: ['./item-catalogo.css'],
})
export class ItemCatalogo implements OnInit {
  item: CatalogoDomain | null = null;
  ingredientesDetalhados: { item: CatalogoDomain; quantidade: number }[] = [];
  carregando = true;

  processandoEditar = false;
  processandoExcluir = false;

  private repoCatalogo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private repoReceitas = new BaseRepositoryV2<ReceitaDomain>('Receitas');

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

      // 1️⃣ Carrega cache local (Catálogo)
      const existente = await this.repoCatalogo.getById(id, true);
      if (existente) {
        this.item = existente;
        this.carregando = false;
        await this.carregarReceita(id);
      }

      // 2️⃣ Sincroniza catálogo e receitas em paralelo
      Promise.all([this.repoCatalogo.sync(), this.repoReceitas.sync()]).then(async (updated) => {
        const atualizado = await this.repoCatalogo.getById(id, true);
        if (atualizado) {
          this.item = atualizado;
          await this.carregarReceita(id);
        }
      });

      // 3️⃣ Fallback online (se não achou local)
      if (!existente) {
        console.log('[ItemCatalogo] Não encontrado localmente → forçando fetch online');
        const online = await this.repoCatalogo.forceFetch();
        const achadoOnline = online.find((i) => String(i.id) === id);
        if (achadoOnline) {
          this.item = achadoOnline;
          await this.carregarReceita(id, true);
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

  /** 🔑 Busca os ingredientes da receita deste item */
  private async carregarReceita(idFabricavel: string, forcarOnline = false) {
    const receitas = forcarOnline
      ? await this.repoReceitas.forceFetch()
      : await this.repoReceitas.getLocal();

    // Filtra só as receitas desse item
    const doItem = receitas.filter((r) => String(r.fabricavel) === String(idFabricavel));

    if (doItem.length === 0) {
      this.ingredientesDetalhados = [];
      return;
    }

    // Carrega catálogo para mapear os ingredientes
    const catalogo = await this.repoCatalogo.getLocal();

    this.ingredientesDetalhados = doItem.map((rec) => {
      const ingItem = catalogo.find((c) => String(c.id) === String(rec.catalogo));
      return {
        item: ingItem || ({} as CatalogoDomain),
        quantidade: rec.quantidade,
      };
    });
  }

  cancelar() {
    this.location.back();
  }

  editarItem() {
    if (!this.item) return;
    this.processandoEditar = true;

    setTimeout(() => {
      this.router.navigate(['/cadastro-item-catalogo', this.item!.id]);
      this.processandoEditar = false;
    }, 300);
  }

  async excluirItem() {
    if (!this.item) return;

    const confirmacao = confirm(`🗑️ Deseja excluir o item "${this.item.nome}"?`);
    if (!confirmacao) return;

    this.processandoExcluir = true;
    try {
      await this.repoCatalogo.delete(this.item.id);
      alert('✅ Item excluído com sucesso!');
      this.router.navigate(['/catalogo']);
    } catch (err) {
      console.error('[ItemCatalogo] Erro ao excluir item:', err);
      alert('❌ Erro ao excluir item. Veja o console.');
    } finally {
      this.processandoExcluir = false;
    }
  }

  getRaridadeClass(raridade?: string): string {
    switch ((raridade || '').toLowerCase()) {
      case 'comum':
        return 'raridade-comum';
      case 'incomum':
        return 'raridade-incomum';
      case 'raro':
        return 'raridade-raro';
      case 'épico':
      case 'epico':
        return 'raridade-epico';
      case 'lendário':
      case 'lendario':
        return 'raridade-lendario';
      default:
        return 'raridade-comum';
    }
  }
}
