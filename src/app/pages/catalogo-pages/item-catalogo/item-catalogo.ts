import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { ReceitaDomain } from '../../../domain/ReceitaDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { ImageModal } from '../../image-modal/image-modal';

@Component({
  selector: 'app-item-catalogo',
  standalone: true,
  imports: [CommonModule, ImageModal],
  templateUrl: './item-catalogo.html',
  styleUrls: ['./item-catalogo.css'],
})
export class ItemCatalogo implements OnInit {
  item: CatalogoDomain | null = null;
  ingredientesDetalhados: { item: CatalogoDomain; quantidade: number }[] = [];
  receitasAssociadas: { produto: CatalogoDomain; quantidade: number }[] = [];
  carregando = true;


  processandoEditar = false;
  processandoExcluir = false;

  // 🔎 controle do modal
  imagemSelecionada: string | null = null;
  modalAberto = false;


  private repoCatalogo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private repoReceitas = new BaseRepositoryV2<ReceitaDomain>('Receitas');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) { }

  async ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      const id = params.get('id');
      if (!id) {
        this.router.navigate(['/catalogo']);
        return;
      }
      await this.carregarItem(id);
    });
  }


  private async carregarItem(id: string) {
    try {
      console.log('[ItemCatalogo] Carregando item', id);
      this.carregando = true;

      // tenta local
      const existente = await this.repoCatalogo.getById(id, true);
      if (existente) {
        this.item = existente;
        await this.carregarReceita(id);
      }

      // sincroniza catálogo e receitas
      Promise.all([this.repoCatalogo.sync(), this.repoReceitas.sync()]).then(async () => {
        const atualizado = await this.repoCatalogo.getById(id, true);
        if (atualizado) {
          this.item = atualizado;
          await this.carregarReceita(id);
        }
      });

      // fallback online
      if (!existente) {
        const online = await this.repoCatalogo.forceFetch();
        const achadoOnline = online.find((i) => String(i.id) === id);
        if (achadoOnline) {
          this.item = achadoOnline;
          await this.carregarReceita(id, true);
        } else {
          this.router.navigate(['/catalogo']);
        }
      }
    } catch (err) {
      console.error('[ItemCatalogo] Erro ao carregar item:', err);
    } finally {
      this.carregando = false;
    }
  }

  /** 🔑 Busca os ingredientes da receita deste item + receitas associadas */
  private async carregarReceita(idFabricavel: string, forcarOnline = false) {
    const receitas = forcarOnline
      ? await this.repoReceitas.forceFetch()
      : await this.repoReceitas.getLocal();

    const catalogo = await this.repoCatalogo.getLocal();

    // ==========================
    // 📦 1) Ingredientes do item
    // ==========================
    const doItem = receitas.filter(r => String(r.fabricavel) === String(idFabricavel));
    this.ingredientesDetalhados = doItem.map(rec => {
      const ingItem = catalogo.find(c => String(c.id) === String(rec.catalogo));
      return {
        item: ingItem || ({} as CatalogoDomain),
        quantidade: rec.quantidade,
      };
    });

    // =====================================
    // 🔗 2) Receitas em que ele é ingrediente
    // =====================================
    const usadasEm = receitas.filter(r => String(r.catalogo) === String(idFabricavel));

    this.receitasAssociadas = usadasEm.map(rec => {
      const produto = catalogo.find(c => String(c.id) === String(rec.fabricavel));
      return {
        produto: produto || ({} as CatalogoDomain),
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

  abrirImagem(src: string) {
    this.imagemSelecionada = src;
    this.modalAberto = true;
  }

  abrirItem(id: string) {
    console.log(id)
    if (!id) return;
    this.router.navigate(['/item-catalogo', String(id)]);
  }

}
