import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';

import { InventarioDomain } from '../../../domain/InventarioDomain';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { RegistroDomain } from '../../../domain/RegistroDomain';
import { JogadorDomain } from '../../../domain/jogadorDomain';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';

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

  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');
  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private registroRepo = new BaseRepositoryV2<RegistroDomain>('Registro');
  private jogadoresRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    try {
      this.carregando = true;
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) throw new Error('ID inválido para item do inventário');

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // Cache first
      const [catalogoLocal, inventarioLocal] = await Promise.all([
        this.catalogoRepo.getLocal(),
        this.inventarioRepo.getLocal(),
      ]);

      const encontrado = inventarioLocal.find(
        (i) => String(i.id) === String(id) && i.jogador === user.email
      );

      if (encontrado)
        this.item = this.montarDetalhe(encontrado, catalogoLocal);

      this.carregando = false;

      // Sync paralelo
      Promise.all([this.catalogoRepo.sync(), this.inventarioRepo.sync()]).then(
        async ([catSync, invSync]) => {
          if (catSync || invSync) {
            const [catAtual, invAtual] = await Promise.all([
              this.catalogoRepo.getLocal(),
              this.inventarioRepo.getLocal(),
            ]);
            const atualizado = invAtual.find(
              (i) => String(i.id) === String(id) && i.jogador === user.email
            );
            if (atualizado)
              this.item = this.montarDetalhe(atualizado, catAtual);
          }
        }
      );
    } catch (err) {
      console.error('[ItemInventario] Erro ao carregar item:', err);
      this.carregando = false;
    }
  }

  private montarDetalhe(
    inventario: InventarioDomain,
    catalogo: CatalogoDomain[]
  ): ItemInventarioDetalhe {
    const detalhe = catalogo.find(
      (c) => String(c.id) === String(inventario.item_catalogo)
    );
    return { inventario, catalogo: detalhe };
  }

  cancelar() {
    this.router.navigate(['/inventario-jogador']);
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
      `🗑️ Deseja remover "${this.item.catalogo?.nome}" do inventário?\nEsta ação será registrada.`
    );
    if (!confirmacao) return;

    this.processandoExcluir = true;

    try {
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      const jogadorEmail = user.email;

      const jogador =
        (await this.jogadoresRepo.getLocal()).find(
          (j) => j.email === jogadorEmail
        ) || null;
      const personagem = jogador?.personagem || 'Você';

      const nomeItem = this.item.catalogo?.nome || 'Item desconhecido';
      const unidade = this.item.catalogo?.unidade_medida || 'unidade(s)';
      const qtdAntes = this.item.inventario.quantidade;

      // 🧾 Cria o registro
      const registro: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: jogadorEmail,
        alvo: jogadorEmail,
        tipo: 'inventario',
        acao: 'removeu um item do inventário',
        detalhes:
          `📦 ${personagem} removeu um item do inventário\n` +
          `🎒 ${nomeItem}: ${qtdAntes} → 0 (-${qtdAntes} ${unidade})\n` +
          `📝 Descrição: item removido manualmente`,
        data: new Date().toISOString(),
      };

      // ⚡ Multioperação otimizada
      await BaseRepositoryV2.batch({
        create: { Registro: [registro] },
        deleteById: { Inventario: [{ id: String(this.item.inventario.id) }] },
      });

      alert(
        `✅ ${personagem} removeu "${nomeItem}" do inventário.\nAção registrada com sucesso.`
      );

      this.router.navigate(['/inventario-jogador']);
    } catch (err) {
      console.error('[ItemInventario] Erro ao excluir item:', err);
      alert('❌ Erro ao excluir item.');
    } finally {
      this.processandoExcluir = false;
    }
  }
}
