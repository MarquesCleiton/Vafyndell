import { Injectable } from '@angular/core';
import { CatalogoRepository } from '../repositories/CatalogoRepository';
import { ReceitasRepository } from '../repositories/ReceitasRepository';
import { InventarioRepository } from '../repositories/InventarioRepository';
import { CatalogoDomain } from '../domain/CatalogoDomain';
import { ReceitaDomain } from '../domain/ReceitaDomain';
import { InventarioDomain } from '../domain/InventarioDomain';
import { AuthService } from '../core/auth/AuthService';

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
  /**
   * Retorna todos os itens fabricáveis do catálogo,
   * já marcando se o jogador pode ou não fabricar com base no inventário.
   */
  async getPossiveisReceitas(): Promise<ReceitaComStatus[]> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    // 1️⃣ Cache first
    let [catalogo, inventario, receitas] = await Promise.all([
      CatalogoRepository.getLocalItens(),
      InventarioRepository.getLocalInventarioByJogador(user.email),
      ReceitasRepository.getLocalReceitas(),
    ]);

    // 2️⃣ Libera UI rápido
    if (catalogo.length && inventario.length && receitas.length) {
      this.sincronizar(user.email).catch(err =>
        console.error('[OficinaService] Erro ao sincronizar:', err)
      );
      return this.processar(catalogo, receitas, inventario);
    }

    // 3️⃣ Fallback: sincroniza na ordem correta
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
   * 🔄 Dispara sincronizações em paralelo
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
  ): ReceitaComStatus[] {
    // 🔑 Mapeia inventário
    const estoque = new Map<number, number>();
    inventario.forEach(i => {
      const atual = estoque.get(i.item_catalogo) || 0;
      estoque.set(i.item_catalogo, atual + i.quantidade);
    });

    // 🔑 Itens fabricáveis (devem ter pelo menos 1 ingrediente)
    const fabricaveis = catalogo.filter(c => {
      const ingredientes = receitas.filter(r => r.fabricavel === c.id);
      return ingredientes.length > 0;
    });

    return fabricaveis
      .map(item => {
        const ingredientes: IngredienteDetalhado[] = receitas
          .filter(r => r.fabricavel === item.id)
          .map(ing => {
            const qtdInventario = estoque.get(ing.catalogo) || 0;
            const ref = catalogo.find(c => c.id === ing.catalogo);
            return {
              ...ing,
              quantidadeInventario: qtdInventario,
              nome: ref?.nome,
              imagem: ref?.imagem,
            };
          });

        // Verifica se pode fabricar (todos ingredientes suficientes)
        const podeFabricar = ingredientes.every(ing =>
          ing.quantidadeInventario >= ing.quantidade
        );

        // Se não possui nenhum ingrediente, descarta
        const possuiAlgum = ingredientes.some(ing => ing.quantidadeInventario > 0);
        if (!possuiAlgum) return null;

        return {
          ...item,
          fabricavel: podeFabricar,
          ingredientes,
        };
      })
      .filter((i): i is ReceitaComStatus => i !== null);
  }

  /**
   * Cria o item (remove ingredientes do inventário e adiciona o produto final)
   */
  async criarItem(receita: ReceitaComStatus): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    // Remove ingredientes
    for (const ing of receita.ingredientes) {
      await InventarioRepository.subtrairQuantidade(user.email, ing.catalogo, ing.quantidade);
    }

    // Adiciona o item fabricado (+1 se já existe, cria se não existe)
    await InventarioRepository.adicionarOuIncrementar(user.email, receita.id, 1);

    console.log(`[OficinaService] Item criado: ${receita.nome}`);
  }

  /**
   * Força falha (remove ingredientes mas não cria o item)
   */
  async forcarFalha(receita: ReceitaComStatus): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    for (const ing of receita.ingredientes) {
      await InventarioRepository.subtrairQuantidade(user.email, ing.catalogo, ing.quantidade);
    }

    console.log(`[OficinaService] Falha forçada ao fabricar: ${receita.nome}`);
  }
}
