import { Injectable } from '@angular/core';
import { CatalogoRepository } from '../app/repositories/CatalogoRepository';
import { ReceitasRepository } from '../app/repositories/ReceitasRepository';
import { InventarioRepository } from '../app/repositories/InventarioRepository';
import { CatalogoDomain } from '../app/domain/CatalogoDomain';
import { ReceitaDomain } from '../app/domain/ReceitaDomain';
import { InventarioDomain } from '../app/domain/InventarioDomain';
import { AuthService } from '../app/core/auth/AuthService';

@Injectable({ providedIn: 'root' })
export class OficinaService {
  /**
   * Retorna todos os itens fabricáveis do catálogo,
   * já marcando se o jogador pode ou não fabricar com base no inventário.
   */
  async getPossiveisReceitas(): Promise<(CatalogoDomain & { fabricavel: boolean })[]> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    // 1️⃣ Cache first: tenta buscar tudo local
    let [catalogo, inventario, receitas] = await Promise.all([
      CatalogoRepository.getLocalItens(),
      InventarioRepository.getLocalInventarioByJogador(user.email),
      ReceitasRepository.getLocalReceitas(),
    ]);

    // 2️⃣ Libera UI rápido se já tinha algo local
    if (catalogo.length && inventario.length && receitas.length) {
      // dispara sync em paralelo
      this.sincronizar(user.email).catch(err =>
        console.error('[OficinaService] Erro ao sincronizar:', err)
      );
      return this.processar(catalogo, receitas, inventario);
    }

    // 3️⃣ Se faltou algo → carrega síncrono na ordem correta
    console.log('[OficinaService] Cache incompleto → carregando dados síncronos...');

    // Catálogo primeiro
    await CatalogoRepository.syncItens();
    catalogo = await CatalogoRepository.getLocalItens();

    // Inventário depois
    await InventarioRepository.syncInventario();
    inventario = await InventarioRepository.getLocalInventarioByJogador(user.email);

    // Receitas por último
    await ReceitasRepository.syncReceitas();
    receitas = await ReceitasRepository.getLocalReceitas();

    return this.processar(catalogo, receitas, inventario);
  }

  /**
   * 🔄 Dispara sincronizações em paralelo para manter atualizado
   */
  private async sincronizar(email: string) {
    const [catSync, invSync, recSync] = await Promise.all([
      CatalogoRepository.syncItens(),
      InventarioRepository.syncInventario(),
      ReceitasRepository.syncReceitas(),
    ]);

    if (catSync || invSync || recSync) {
      console.log('[OficinaService] Alguma tabela foi atualizada → dados locais recarregados');
    } else {
      console.log('[OficinaService] Nenhuma alteração nas tabelas.');
    }
  }

  /**
   * Processa e monta a lista de fabricáveis
   */
  private processar(
    catalogo: CatalogoDomain[],
    receitas: ReceitaDomain[],
    inventario: InventarioDomain[],
  ): (CatalogoDomain & { fabricavel: boolean })[] {
    // 🔑 Mapeia inventário para acesso rápido
    const estoque = new Map<number, number>();
    inventario.forEach(i => {
      const atual = estoque.get(i.item_catalogo) || 0;
      estoque.set(i.item_catalogo, atual + i.quantidade);
    });

    // 🔑 Itens que são fabricáveis
    const fabricaveisIds = new Set(receitas.map(r => r.fabricavel));
    const fabricaveis = catalogo.filter(c => fabricaveisIds.has(c.id));

    return fabricaveis.map(item => {
      const ingredientes = receitas.filter(r => r.fabricavel === item.id);

      const podeFabricar = ingredientes.every(ing => {
        const qtdNoEstoque = estoque.get(ing.catalogo) || 0;
        return qtdNoEstoque >= ing.quantidade;
      });

      return {
        ...item,
        fabricavel: podeFabricar,
      };
    });
  }
}
