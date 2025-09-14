import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/BaseRepository';
import { CatalogoDomain } from '../domain/CatalogoDomain';
import { ReceitaDomain } from '../domain/ReceitaDomain';
import { InventarioDomain } from '../domain/InventarioDomain';
import { AuthService } from '../core/auth/AuthService';
import { IdUtils } from '../core/utils/IdUtils';

export interface IngredienteDetalhado extends ReceitaDomain {
  quantidadeInventario: number;
  nome?: string;
  imagem?: string;
}

export type ReceitaComStatus = CatalogoDomain & {
  fabricavel: boolean;
  ingredientes: IngredienteDetalhado[];
};

@Injectable({ providedIn: 'root' })
export class OficinaService {
  private catalogoRepo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');
  private inventarioRepo = new BaseRepository<InventarioDomain>('Inventario', 'Inventario');
  private receitasRepo = new BaseRepository<ReceitaDomain>('Receitas', 'Receitas');

  /**
   * Retorna todos os itens fabricáveis do catálogo,
   * já marcando se o jogador pode ou não fabricar com base no inventário.
   */
  async getPossiveisReceitas(): Promise<ReceitaComStatus[]> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    // 1️⃣ Cache first
    let [catalogo, inventario, receitas] = await Promise.all([
      this.catalogoRepo.getLocal(),
      this.inventarioRepo.getLocal(),
      this.receitasRepo.getLocal(),
    ]);

    // filtra só inventário do jogador
    inventario = inventario.filter((i) => i.jogador === user.email);

    if (catalogo.length && inventario.length && receitas.length) {
      this.sincronizar(user.email).catch((err) =>
        console.error('[OficinaService] Erro ao sincronizar:', err)
      );
      return this.processar(catalogo, receitas, inventario);
    }

    // 2️⃣ fallback
    await this.catalogoRepo.sync();
    catalogo = await this.catalogoRepo.getLocal();

    await this.inventarioRepo.sync();
    inventario = (await this.inventarioRepo.getLocal()).filter((i) => i.jogador === user.email);

    await this.receitasRepo.sync();
    receitas = await this.receitasRepo.getLocal();

    return this.processar(catalogo, receitas, inventario);
  }

  private async sincronizar(email: string) {
    const [catSync, invSync, recSync] = await Promise.all([
      this.catalogoRepo.sync(),
      this.inventarioRepo.sync(),
      this.receitasRepo.sync(),
    ]);

    if (catSync || invSync || recSync) {
      console.log('[OficinaService] Alguma tabela foi atualizada → dados locais recarregados');
    } else {
      console.log('[OficinaService] Nenhuma alteração nas tabelas.');
    }
  }

  private processar(
    catalogo: CatalogoDomain[],
    receitas: ReceitaDomain[],
    inventario: InventarioDomain[]
  ): ReceitaComStatus[] {
    // 🔑 Mapeia inventário
    const estoque = new Map<string, number>();
    inventario.forEach((i) => {
      const key = String(i.item_catalogo);
      const atual = estoque.get(key) || 0;
      estoque.set(key, atual + (i.quantidade || 0));
    });
    console.log('[OficinaService] Estoque calculado:', Array.from(estoque.entries()));

    // 🔑 Itens fabricáveis (devem ter pelo menos 1 ingrediente)
    const fabricaveis = catalogo.filter((c) =>
      receitas.some((r) => String(r.fabricavel) === String(c.id))
    );
    console.log('[OficinaService] Fabricáveis encontrados:', fabricaveis.length);

    return fabricaveis
      .map((item) => {
        const ingredientes: IngredienteDetalhado[] = receitas
          .filter((r) => String(r.fabricavel) === String(item.id))
          .map((ing) => {
            const qtdInventario = estoque.get(String(ing.catalogo)) || 0;
            const ref = catalogo.find((c) => String(c.id) === String(ing.catalogo));

            if (!ref) {
              console.warn(
                '[OficinaService] ❗ Ingrediente não encontrado no catálogo:',
                ing.catalogo
              );
            }

            return {
              ...ing,
              quantidadeInventario: qtdInventario,
              nome: ref?.nome,
              imagem: ref?.imagem,
            };
          });

        // Verifica se pode fabricar (todos ingredientes suficientes)
        const podeFabricar = ingredientes.every(
          (ing) => ing.quantidadeInventario >= ing.quantidade
        );

        // Se não possui nenhum ingrediente, descarta
        const possuiAlgum = ingredientes.some((ing) => ing.quantidadeInventario > 0);
        if (!possuiAlgum) return null;

        return {
          ...item,
          fabricavel: podeFabricar,
          ingredientes,
        };
      })
      .filter((i): i is ReceitaComStatus => i !== null);
  }


  async criarItem(receita: ReceitaComStatus): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    // remove ingredientes
    for (const ing of receita.ingredientes) {
      await this.subtrairQuantidade(user.email, ing.catalogo, ing.quantidade);
    }

    // adiciona produto final
    await this.adicionarOuIncrementar(user.email, receita.id, 1);
    console.log(`[OficinaService] Item criado: ${receita.nome}`);
  }

  async forcarFalha(receita: ReceitaComStatus): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    for (const ing of receita.ingredientes) {
      await this.subtrairQuantidade(user.email, ing.catalogo, ing.quantidade);
    }
    console.log(`[OficinaService] Falha forçada: ${receita.nome}`);
  }

  // === Helpers ===

  private async subtrairQuantidade(jogador: string, itemCatalogo: string, qtd: number) {
    const todos = (await this.inventarioRepo.getLocal()).filter((i) => i.jogador === jogador);
    const encontrado = todos.find((i) => i.item_catalogo === itemCatalogo);
    if (!encontrado) return;

    encontrado.quantidade = Math.max(0, (encontrado.quantidade || 0) - qtd);
    if (encontrado.quantidade === 0) {
      await this.inventarioRepo.delete(encontrado.id);
    } else {
      await this.inventarioRepo.update(encontrado);
    }
  }

  private async adicionarOuIncrementar(jogador: string, itemCatalogo: string, qtd: number) {
    const todos = (await this.inventarioRepo.getLocal()).filter((i) => i.jogador === jogador);
    const existente = todos.find((i) => i.item_catalogo === itemCatalogo);

    if (existente) {
      existente.quantidade += qtd;
      await this.inventarioRepo.update(existente);
    } else {
      await this.inventarioRepo.create({
        id: IdUtils.generateULID(),
        index: todos.length + 1,
        jogador,
        item_catalogo: itemCatalogo,
        quantidade: qtd,
      } as InventarioDomain);
    }
  }
}
