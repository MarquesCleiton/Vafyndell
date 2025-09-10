import { Injectable } from '@angular/core';
import { CatalogoRepository } from '../repositories/CatalogoRepository';
import { ReceitasRepository } from '../repositories/ReceitasRepository';
import { InventarioRepository } from '../repositories/InventarioRepository';
import { CatalogoDomain } from '../domain/CatalogoDomain';
import { ReceitaDomain } from '../domain/ReceitaDomain';
import { InventarioDomain } from '../domain/InventarioDomain';
import { AuthService } from '../core/auth/AuthService';

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
      this.sincronizar(user.email).catch(err =>
        console.error('[OficinaService] Erro ao sincronizar:', err)
      );
      return this.processar(catalogo, receitas, inventario);
    }

    // 3️⃣ Se faltou algo → carrega síncrono na ordem correta
    console.log('[OficinaService] Cache incompleto → carregando dados síncronos...');

    await CatalogoRepository.syncItens();
    catalogo = await CatalogoRepository.getLocalItens();

    await InventarioRepository.syncInventario();
    inventario = await InventarioRepository.getLocalInventarioByJogador(user.email);

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
    // 🔑 Mapeia inventário para acesso rápido (por ID do item de catálogo)
    const estoque = new Map<number, number>();
    inventario.forEach(i => {
      const atual = estoque.get(i.item_catalogo) || 0;
      estoque.set(i.item_catalogo, atual + i.quantidade);
    });


    // 🔑 Itens fabricáveis de fato (devem ter pelo menos 1 ingrediente)
    const fabricaveis = catalogo.filter(c => {
      const ingredientes = receitas.filter(r => r.fabricavel === c.id);
      return ingredientes.length > 0;
    });

    return fabricaveis
      .map(item => {
        const ingredientes = receitas.filter(r => r.fabricavel === item.id);

        // 1️⃣ Jogador possui pelo menos 1 ingrediente?
        const possuiAlgumIngrediente = ingredientes.some(ing => {
          const qtdNoEstoque = estoque.get(ing.catalogo) || 0;
          return qtdNoEstoque > 0;
        });

        if (!possuiAlgumIngrediente) {
          return null;
        }

        // 2️⃣ Verifica se pode fabricar (todos ingredientes suficientes)
        const podeFabricar = ingredientes.every(ing => {
          const qtdNoEstoque = estoque.get(ing.catalogo) || 0;
          return qtdNoEstoque >= ing.quantidade;
        });



        return {
          ...item,
          fabricavel: podeFabricar,
        };
      })
      .filter((i): i is CatalogoDomain & { fabricavel: boolean } => i !== null);
  }

}
